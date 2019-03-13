import fs = require("fs");
import yaml = require("js-yaml");
import _ from "lodash";
import { DataStore } from "./dataStore";
import { SecretStore } from "./secretStore";
import { IAccountBalance, IBankDataProviderInterface, IInstitutionRelationship } from "./types";

interface IBeanniConfig {
    relationships: IInstitutionRelationship[];
}

export interface IBeanniExecutionContext {
    debug: boolean;
}

const CONFIG_PATH = "./config.yaml";

export class Core {
    public dataStore: DataStore;
    public secretStore: SecretStore;

    constructor(dataStore: DataStore, secretStore: SecretStore) {
        this.dataStore = dataStore;
        this.secretStore = secretStore;
    }

    public async loadConfig(): Promise<IBeanniConfig> {
        const configFileText = fs.readFileSync(CONFIG_PATH, "utf8");
        const config =  yaml.safeLoad(configFileText) as IBeanniConfig;

        config.relationships.forEach((r) => {
            if (r.name == null) {
                r.name = r.provider;
            }
        });

        const duplicateRelationshipNames = _(config.relationships)
            .groupBy((r: IInstitutionRelationship) => r.name)
            .pickBy((x) => x.length > 1)
            .keys()
            .value();
        if (duplicateRelationshipNames.length > 0) {
            throw new Error(
                "Duplicate relationships: " + duplicateRelationshipNames.join(", ") +
                "\nTo re-use the same provider multiple times, add a name property as well");
        }

        return config;
    }

    public async validateConfig() {
        const config = await this.loadConfig();
        console.log("Config appears valid:");
        console.log(JSON.stringify(config, null, 2));
    }

    public async fetch(executionContext: IBeanniExecutionContext) {
        const config = await this.loadConfig();
        console.log("%s relationships to fetch from", config.relationships.length);

        const balances = new Array<IAccountBalance>();

        try {
            await this.dataStore.open();

            for (const relationship of config.relationships) {
                console.log("Fetching '%s' via '%s'", relationship.name, relationship.provider);
                const providerName = relationship.provider;
                const module = require("./providers/" + providerName);
                const provider =  new module[providerName](executionContext) as IBankDataProviderInterface;

                try {
                    await provider.login(async (key: string) => {
                        return await this.secretStore.retrieveSecret(relationship.name + ":" + key);
                    });

                    const relationshipBalances = await provider.getBalances();
                    console.log("Found %s accounts", relationshipBalances.length);
                    relationshipBalances.forEach((b) => {
                        balances.push(b);
                        this.dataStore.addBalance(b);
                    });
                } catch (ex) {
                    console.error(ex);
                } finally {
                    await provider.logout();
                }
            }

            console.log("Written %s balance entries to the data store", balances.length);
        } finally {
            await this.dataStore.close();
        }
    }

    public async init(executionContext: IBeanniExecutionContext) {
        try {
            await fs.promises.access(CONFIG_PATH, fs.constants.F_OK);
            console.error("There's already a config.yaml file on disk; leaving it as-is");
        } catch {
            await fs.promises.copyFile(
                __dirname + "/../src/example-config.yaml",
                CONFIG_PATH,
                fs.constants.COPYFILE_EXCL,
            );
            console.log("Created config.yaml");
        }
    }
}

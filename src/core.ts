import fs = require("fs");
import yaml = require("js-yaml");
import _ from "lodash";
import { DataStore } from "./dataStore";
import { ISecretStore } from "./types";
import {
    IAccountBalance,
    IBankDataDocumentProviderInterface,
    IBankDataProviderInterface,
    IInstitutionRelationship,
} from "./types";

interface IBeanniConfig {
    relationships: IInstitutionRelationship[];
}

export interface IBeanniExecutionContext {
    debug: boolean;
}

const CONFIG_PATH = "./config.yaml";
const STATEMENT_PATH = "./statements/";

export class Core {
    public dataStore: DataStore;
    public secretStore: ISecretStore;

    constructor(dataStore: DataStore, secretStore: ISecretStore) {
        this.dataStore = dataStore;
        this.secretStore = secretStore;
    }

    public async loadConfig(): Promise<IBeanniConfig> {
        if (! fs.existsSync(CONFIG_PATH)) {
            throw new Error("No config file found at " + CONFIG_PATH + "; try running `beanni init` first");
        }

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

        await fs.promises.mkdir(STATEMENT_PATH, { recursive: true });

        const balances = new Array<IAccountBalance>();

        try {
            await this.dataStore.open();

            for (const relationship of config.relationships) {
                console.log("[%s] Fetching '%s'", relationship.provider, relationship.name);
                const providerName = relationship.provider;
                const module = require("./providers/" + providerName);
                const provider =  new module[providerName](executionContext) as IBankDataProviderInterface;

                try {
                    console.log("[%s] Logging in", relationship.provider);
                    await provider.login(async (key: string) => {
                        return await this.secretStore.retrieveSecret(relationship.name + ":" + key);
                    });

                    console.log("[%s] Getting balances", relationship.provider);
                    const relationshipBalances = await provider.getBalances();
                    console.log("[%s] Found %s balances", relationship.provider, relationshipBalances.length);
                    relationshipBalances.forEach((b) => {
                        balances.push(b);
                        this.dataStore.addBalance(b);
                    });

                    if (this.isDocumentProvider(provider)) {
                        const documentProvider = provider as IBankDataDocumentProviderInterface;
                        console.log("[%s] Getting documents", relationship.provider);
                        await documentProvider.getDocuments(STATEMENT_PATH);
                    } else {
                        console.log("[%s] Doesn't support documents; skipping", relationship.provider);
                    }
                } catch (ex) {
                    console.error(ex);
                } finally {
                    console.log("[%s] Logging out", relationship.provider);
                    await provider.logout();
                }
            }

            console.log("Written %s balance entries to the data store", balances.length);
        } finally {
            await this.dataStore.close();
        }
    }

    public isDocumentProvider(provider: IBankDataProviderInterface | IBankDataDocumentProviderInterface)
        : provider is IBankDataDocumentProviderInterface {
        return ( provider as IBankDataDocumentProviderInterface).getDocuments !== undefined;
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

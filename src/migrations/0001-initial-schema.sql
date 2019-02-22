-- Up

CREATE TABLE Balances
(
    id INTEGER PRIMARY KEY,
    institution TEXT,
    accountNumber TEXT,
    accountName TEXT,
    balance INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Down

DROP TABLE Balances;

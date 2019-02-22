-- Up

CREATE TABLE Balances
(
    id INTEGER PRIMARY KEY,
    accountNumber TEXT,
    accountName TEXT,
    institution TEXT,
    balance INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Down

DROP TABLE Balances;

export type MeanMultisig = {
  "version": "1.16.0",
  "name": "mean_multisig",
  "instructions": [
    {
      "name": "createMultisig",
      "docs": [
        "Initializes a new multisig account with a set of owners and a threshold."
      ],
      "accounts": [
        {
          "name": "proposer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "multisig",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "opsAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "settings",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "owners",
          "type": {
            "vec": {
              "defined": "Owner"
            }
          }
        },
        {
          "name": "threshold",
          "type": "u64"
        },
        {
          "name": "nonce",
          "type": "u8"
        },
        {
          "name": "label",
          "type": "string"
        }
      ]
    },
    {
      "name": "editMultisig",
      "docs": [
        "Modify a multisig account data"
      ],
      "accounts": [
        {
          "name": "multisig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "multisigSigner",
          "isMut": false,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "owners",
          "type": {
            "vec": {
              "defined": "Owner"
            }
          }
        },
        {
          "name": "threshold",
          "type": "u64"
        },
        {
          "name": "label",
          "type": "string"
        }
      ]
    },
    {
      "name": "createTransaction",
      "docs": [
        "Creates a new transaction account, automatically signed by the creator,",
        "which must be one of the owners of the multisig."
      ],
      "accounts": [
        {
          "name": "multisig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "transaction",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "transactionDetail",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "opsAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "settings",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "pid",
          "type": "publicKey"
        },
        {
          "name": "accs",
          "type": {
            "vec": {
              "defined": "TransactionAccount"
            }
          }
        },
        {
          "name": "data",
          "type": "bytes"
        },
        {
          "name": "operation",
          "type": "u8"
        },
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "description",
          "type": "string"
        },
        {
          "name": "expirationDate",
          "type": "u64"
        },
        {
          "name": "pdaTimestamp",
          "type": "u64"
        },
        {
          "name": "pdaBump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "cancelTransaction",
      "docs": [
        "Cancel a previously voided Tx"
      ],
      "accounts": [
        {
          "name": "multisig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "transaction",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "transactionDetail",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "approve",
      "docs": [
        "Approves a transaction on behalf of an owner of the multisig."
      ],
      "accounts": [
        {
          "name": "multisig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "transaction",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "transactionDetail",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "reject",
      "docs": [
        "Rejects a transaction on behalf of an owner of the multisig."
      ],
      "accounts": [
        {
          "name": "multisig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "transaction",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "transactionDetail",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "executeTransaction",
      "docs": [
        "Executes the given transaction if threshold owners have signed it."
      ],
      "accounts": [
        {
          "name": "multisig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "multisigSigner",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "transaction",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "transactionDetail",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "executeTransactionWithReplacements",
      "docs": [
        "Executes the given transaction if threshold owners have signed it."
      ],
      "accounts": [
        {
          "name": "multisig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "multisigSigner",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "transaction",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "transactionDetail",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "replacementAccounts",
          "type": {
            "vec": "publicKey"
          }
        }
      ]
    },
    {
      "name": "initSettings",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "settings",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "program",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "programData",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "updateSettings",
      "accounts": [
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "settings",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "program",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "programData",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "authority",
          "type": "publicKey"
        },
        {
          "name": "opsAccount",
          "type": "publicKey"
        },
        {
          "name": "createMultisigFee",
          "type": "u64"
        },
        {
          "name": "createTransactionFee",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "multisigV2",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owners",
            "docs": [
              "multisig account owners"
            ],
            "type": {
              "array": [
                {
                  "defined": "OwnerData"
                },
                10
              ]
            }
          },
          {
            "name": "version",
            "docs": [
              "multisig account version"
            ],
            "type": "u8"
          },
          {
            "name": "nonce",
            "docs": [
              "multisig nonce"
            ],
            "type": "u8"
          },
          {
            "name": "label",
            "docs": [
              "multisig label (name or description)"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "ownerSetSeqno",
            "docs": [
              "multisig owner set secuency number"
            ],
            "type": "u32"
          },
          {
            "name": "threshold",
            "docs": [
              "multisig required signers threshold"
            ],
            "type": "u64"
          },
          {
            "name": "pendingTxs",
            "docs": [
              "amount of transaction pending for approval in the multisig"
            ],
            "type": "u64"
          },
          {
            "name": "createdOn",
            "docs": [
              "created time in seconds"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "transaction",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "multisig",
            "docs": [
              "The multisig account this transaction belongs to."
            ],
            "type": "publicKey"
          },
          {
            "name": "programId",
            "docs": [
              "Target program to execute against."
            ],
            "type": "publicKey"
          },
          {
            "name": "accounts",
            "docs": [
              "Accounts requried for the transaction."
            ],
            "type": {
              "vec": {
                "defined": "TransactionAccount"
              }
            }
          },
          {
            "name": "data",
            "docs": [
              "Instruction data for the transaction."
            ],
            "type": "bytes"
          },
          {
            "name": "signers",
            "docs": [
              "signers[index] is true if multisig.owners[index] signed the transaction."
            ],
            "type": "bytes"
          },
          {
            "name": "ownerSetSeqno",
            "docs": [
              "Owner set sequence number."
            ],
            "type": "u32"
          },
          {
            "name": "createdOn",
            "docs": [
              "Created blocktime"
            ],
            "type": "u64"
          },
          {
            "name": "executedOn",
            "docs": [
              "Executed blocktime"
            ],
            "type": "u64"
          },
          {
            "name": "operation",
            "docs": [
              "Operation number"
            ],
            "type": "u8"
          },
          {
            "name": "keypairs",
            "docs": [
              "[deprecated] Signatures required for the transaction"
            ],
            "type": {
              "vec": {
                "array": [
                  "u8",
                  64
                ]
              }
            }
          },
          {
            "name": "proposer",
            "docs": [
              "The proposer of the transaction"
            ],
            "type": "publicKey"
          },
          {
            "name": "pdaTimestamp",
            "docs": [
              "The timestamp used as part of the seed of the PDA account"
            ],
            "type": "u64"
          },
          {
            "name": "pdaBump",
            "docs": [
              "The bump used to derive the PDA account"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "transactionDetail",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "title",
            "docs": [
              "A short title to identify the transaction"
            ],
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          },
          {
            "name": "description",
            "docs": [
              "A long description with more details about the transaction"
            ],
            "type": {
              "array": [
                "u8",
                512
              ]
            }
          },
          {
            "name": "expirationDate",
            "docs": [
              "Expiration date (timestamp)"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "settings",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "docs": [
              "Account version"
            ],
            "type": "u8"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          },
          {
            "name": "authority",
            "docs": [
              "Account authority"
            ],
            "type": "publicKey"
          },
          {
            "name": "opsAccount",
            "docs": [
              "Fees account"
            ],
            "type": "publicKey"
          },
          {
            "name": "createMultisigFee",
            "docs": [
              "Fee amount in lamports"
            ],
            "type": "u64"
          },
          {
            "name": "createTransactionFee",
            "docs": [
              "Fee amount in lamports"
            ],
            "type": "u64"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "Owner",
      "docs": [
        "Owner parameter passed on create and edit multisig"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "address",
            "type": "publicKey"
          },
          {
            "name": "name",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "OwnerData",
      "docs": [
        "The owner data saved in the multisig account data"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "address",
            "type": "publicKey"
          },
          {
            "name": "name",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "TransactionAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pubkey",
            "type": "publicKey"
          },
          {
            "name": "isSigner",
            "type": "bool"
          },
          {
            "name": "isWritable",
            "type": "bool"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidOwner",
      "msg": "The given owner is not part of this multisig."
    },
    {
      "code": 6001,
      "name": "InvalidOwnersLen",
      "msg": "Owners length must be non zero."
    },
    {
      "code": 6002,
      "name": "NotEnoughSigners",
      "msg": "Not enough owners signed this transaction."
    },
    {
      "code": 6003,
      "name": "TransactionAlreadySigned",
      "msg": "Cannot delete a transaction that has been signed by an owner."
    },
    {
      "code": 6004,
      "name": "Overflow",
      "msg": "Operation overflow."
    },
    {
      "code": 6005,
      "name": "UnableToDelete",
      "msg": "Cannot delete a transaction the owner did not create."
    },
    {
      "code": 6006,
      "name": "AlreadyExecuted",
      "msg": "The given transaction has already been executed."
    },
    {
      "code": 6007,
      "name": "AlreadyExpired",
      "msg": "Transaction proposal has expired."
    },
    {
      "code": 6008,
      "name": "InvalidThreshold",
      "msg": "Threshold must be less than or equal to the number of owners."
    },
    {
      "code": 6009,
      "name": "UniqueOwners",
      "msg": "Owners must be unique."
    },
    {
      "code": 6010,
      "name": "OwnerNameTooLong",
      "msg": "Owner name must have less than 32 bytes."
    },
    {
      "code": 6011,
      "name": "InvalidMultisigNonce",
      "msg": "Multisig nonce is not valid."
    },
    {
      "code": 6012,
      "name": "InvalidMultisigVersion",
      "msg": "Multisig version is not valid."
    },
    {
      "code": 6013,
      "name": "InvalidOwnerSetSeqNumber",
      "msg": "Multisig owner set secuency number is not valid."
    },
    {
      "code": 6014,
      "name": "InvalidMultisig",
      "msg": "Multisig account is not valid."
    },
    {
      "code": 6015,
      "name": "InvalidSettingsAuthority",
      "msg": "Invalid settings authority."
    },
    {
      "code": 6016,
      "name": "NotEnoughReplacementAccounts",
      "msg": "Not enough replacement accounts."
    },
    {
      "code": 6017,
      "name": "FeeExceedsMaximumAllowed",
      "msg": "Fee amount exceeds the maximum allowed."
    }
  ]
};

export const IDL: MeanMultisig = {
  "version": "1.16.0",
  "name": "mean_multisig",
  "instructions": [
    {
      "name": "createMultisig",
      "docs": [
        "Initializes a new multisig account with a set of owners and a threshold."
      ],
      "accounts": [
        {
          "name": "proposer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "multisig",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "opsAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "settings",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "owners",
          "type": {
            "vec": {
              "defined": "Owner"
            }
          }
        },
        {
          "name": "threshold",
          "type": "u64"
        },
        {
          "name": "nonce",
          "type": "u8"
        },
        {
          "name": "label",
          "type": "string"
        }
      ]
    },
    {
      "name": "editMultisig",
      "docs": [
        "Modify a multisig account data"
      ],
      "accounts": [
        {
          "name": "multisig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "multisigSigner",
          "isMut": false,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "owners",
          "type": {
            "vec": {
              "defined": "Owner"
            }
          }
        },
        {
          "name": "threshold",
          "type": "u64"
        },
        {
          "name": "label",
          "type": "string"
        }
      ]
    },
    {
      "name": "createTransaction",
      "docs": [
        "Creates a new transaction account, automatically signed by the creator,",
        "which must be one of the owners of the multisig."
      ],
      "accounts": [
        {
          "name": "multisig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "transaction",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "transactionDetail",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "opsAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "settings",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "pid",
          "type": "publicKey"
        },
        {
          "name": "accs",
          "type": {
            "vec": {
              "defined": "TransactionAccount"
            }
          }
        },
        {
          "name": "data",
          "type": "bytes"
        },
        {
          "name": "operation",
          "type": "u8"
        },
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "description",
          "type": "string"
        },
        {
          "name": "expirationDate",
          "type": "u64"
        },
        {
          "name": "pdaTimestamp",
          "type": "u64"
        },
        {
          "name": "pdaBump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "cancelTransaction",
      "docs": [
        "Cancel a previously voided Tx"
      ],
      "accounts": [
        {
          "name": "multisig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "transaction",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "transactionDetail",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "approve",
      "docs": [
        "Approves a transaction on behalf of an owner of the multisig."
      ],
      "accounts": [
        {
          "name": "multisig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "transaction",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "transactionDetail",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "reject",
      "docs": [
        "Rejects a transaction on behalf of an owner of the multisig."
      ],
      "accounts": [
        {
          "name": "multisig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "transaction",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "transactionDetail",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "executeTransaction",
      "docs": [
        "Executes the given transaction if threshold owners have signed it."
      ],
      "accounts": [
        {
          "name": "multisig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "multisigSigner",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "transaction",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "transactionDetail",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "executeTransactionWithReplacements",
      "docs": [
        "Executes the given transaction if threshold owners have signed it."
      ],
      "accounts": [
        {
          "name": "multisig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "multisigSigner",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "transaction",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "transactionDetail",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "replacementAccounts",
          "type": {
            "vec": "publicKey"
          }
        }
      ]
    },
    {
      "name": "initSettings",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "settings",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "program",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "programData",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "updateSettings",
      "accounts": [
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "settings",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "program",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "programData",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "authority",
          "type": "publicKey"
        },
        {
          "name": "opsAccount",
          "type": "publicKey"
        },
        {
          "name": "createMultisigFee",
          "type": "u64"
        },
        {
          "name": "createTransactionFee",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "multisigV2",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owners",
            "docs": [
              "multisig account owners"
            ],
            "type": {
              "array": [
                {
                  "defined": "OwnerData"
                },
                10
              ]
            }
          },
          {
            "name": "version",
            "docs": [
              "multisig account version"
            ],
            "type": "u8"
          },
          {
            "name": "nonce",
            "docs": [
              "multisig nonce"
            ],
            "type": "u8"
          },
          {
            "name": "label",
            "docs": [
              "multisig label (name or description)"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "ownerSetSeqno",
            "docs": [
              "multisig owner set secuency number"
            ],
            "type": "u32"
          },
          {
            "name": "threshold",
            "docs": [
              "multisig required signers threshold"
            ],
            "type": "u64"
          },
          {
            "name": "pendingTxs",
            "docs": [
              "amount of transaction pending for approval in the multisig"
            ],
            "type": "u64"
          },
          {
            "name": "createdOn",
            "docs": [
              "created time in seconds"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "transaction",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "multisig",
            "docs": [
              "The multisig account this transaction belongs to."
            ],
            "type": "publicKey"
          },
          {
            "name": "programId",
            "docs": [
              "Target program to execute against."
            ],
            "type": "publicKey"
          },
          {
            "name": "accounts",
            "docs": [
              "Accounts requried for the transaction."
            ],
            "type": {
              "vec": {
                "defined": "TransactionAccount"
              }
            }
          },
          {
            "name": "data",
            "docs": [
              "Instruction data for the transaction."
            ],
            "type": "bytes"
          },
          {
            "name": "signers",
            "docs": [
              "signers[index] is true if multisig.owners[index] signed the transaction."
            ],
            "type": "bytes"
          },
          {
            "name": "ownerSetSeqno",
            "docs": [
              "Owner set sequence number."
            ],
            "type": "u32"
          },
          {
            "name": "createdOn",
            "docs": [
              "Created blocktime"
            ],
            "type": "u64"
          },
          {
            "name": "executedOn",
            "docs": [
              "Executed blocktime"
            ],
            "type": "u64"
          },
          {
            "name": "operation",
            "docs": [
              "Operation number"
            ],
            "type": "u8"
          },
          {
            "name": "keypairs",
            "docs": [
              "[deprecated] Signatures required for the transaction"
            ],
            "type": {
              "vec": {
                "array": [
                  "u8",
                  64
                ]
              }
            }
          },
          {
            "name": "proposer",
            "docs": [
              "The proposer of the transaction"
            ],
            "type": "publicKey"
          },
          {
            "name": "pdaTimestamp",
            "docs": [
              "The timestamp used as part of the seed of the PDA account"
            ],
            "type": "u64"
          },
          {
            "name": "pdaBump",
            "docs": [
              "The bump used to derive the PDA account"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "transactionDetail",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "title",
            "docs": [
              "A short title to identify the transaction"
            ],
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          },
          {
            "name": "description",
            "docs": [
              "A long description with more details about the transaction"
            ],
            "type": {
              "array": [
                "u8",
                512
              ]
            }
          },
          {
            "name": "expirationDate",
            "docs": [
              "Expiration date (timestamp)"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "settings",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "docs": [
              "Account version"
            ],
            "type": "u8"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          },
          {
            "name": "authority",
            "docs": [
              "Account authority"
            ],
            "type": "publicKey"
          },
          {
            "name": "opsAccount",
            "docs": [
              "Fees account"
            ],
            "type": "publicKey"
          },
          {
            "name": "createMultisigFee",
            "docs": [
              "Fee amount in lamports"
            ],
            "type": "u64"
          },
          {
            "name": "createTransactionFee",
            "docs": [
              "Fee amount in lamports"
            ],
            "type": "u64"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "Owner",
      "docs": [
        "Owner parameter passed on create and edit multisig"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "address",
            "type": "publicKey"
          },
          {
            "name": "name",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "OwnerData",
      "docs": [
        "The owner data saved in the multisig account data"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "address",
            "type": "publicKey"
          },
          {
            "name": "name",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "TransactionAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pubkey",
            "type": "publicKey"
          },
          {
            "name": "isSigner",
            "type": "bool"
          },
          {
            "name": "isWritable",
            "type": "bool"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidOwner",
      "msg": "The given owner is not part of this multisig."
    },
    {
      "code": 6001,
      "name": "InvalidOwnersLen",
      "msg": "Owners length must be non zero."
    },
    {
      "code": 6002,
      "name": "NotEnoughSigners",
      "msg": "Not enough owners signed this transaction."
    },
    {
      "code": 6003,
      "name": "TransactionAlreadySigned",
      "msg": "Cannot delete a transaction that has been signed by an owner."
    },
    {
      "code": 6004,
      "name": "Overflow",
      "msg": "Operation overflow."
    },
    {
      "code": 6005,
      "name": "UnableToDelete",
      "msg": "Cannot delete a transaction the owner did not create."
    },
    {
      "code": 6006,
      "name": "AlreadyExecuted",
      "msg": "The given transaction has already been executed."
    },
    {
      "code": 6007,
      "name": "AlreadyExpired",
      "msg": "Transaction proposal has expired."
    },
    {
      "code": 6008,
      "name": "InvalidThreshold",
      "msg": "Threshold must be less than or equal to the number of owners."
    },
    {
      "code": 6009,
      "name": "UniqueOwners",
      "msg": "Owners must be unique."
    },
    {
      "code": 6010,
      "name": "OwnerNameTooLong",
      "msg": "Owner name must have less than 32 bytes."
    },
    {
      "code": 6011,
      "name": "InvalidMultisigNonce",
      "msg": "Multisig nonce is not valid."
    },
    {
      "code": 6012,
      "name": "InvalidMultisigVersion",
      "msg": "Multisig version is not valid."
    },
    {
      "code": 6013,
      "name": "InvalidOwnerSetSeqNumber",
      "msg": "Multisig owner set secuency number is not valid."
    },
    {
      "code": 6014,
      "name": "InvalidMultisig",
      "msg": "Multisig account is not valid."
    },
    {
      "code": 6015,
      "name": "InvalidSettingsAuthority",
      "msg": "Invalid settings authority."
    },
    {
      "code": 6016,
      "name": "NotEnoughReplacementAccounts",
      "msg": "Not enough replacement accounts."
    },
    {
      "code": 6017,
      "name": "FeeExceedsMaximumAllowed",
      "msg": "Fee amount exceeds the maximum allowed."
    }
  ]
};

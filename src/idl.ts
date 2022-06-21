import { Idl } from "@project-serum/anchor";

const idl: Idl = {
  version: "1.13.0",
  name: "mean_multisig",
  instructions: [
    {
      "name": "createMultisig",
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
          "name": "multisigOpsAccount",
          "isMut": true,
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
          "name": "multisigOpsAccount",
          "isMut": true,
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
      "name": "executeTransactionPda",
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
          "name": "pdaAccount",
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
          "name": "pdaTimestamp",
          "type": "u64"
        },
        {
          "name": "pdaBump",
          "type": "u8"
        }
      ]
    }
  ],
  accounts: [
    {
      "name": "Multisig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owners",
            "type": {
              "vec": "publicKey"
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
            "name": "ownerSetSeqno",
            "type": "u32"
          },
          {
            "name": "label",
            "type": "string"
          },
          {
            "name": "createdOn",
            "type": "u64"
          },
          {
            "name": "pendingTxs",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "MultisigV2",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owners",
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
            "type": "u8"
          },
          {
            "name": "nonce",
            "type": "u8"
          },
          {
            "name": "label",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "ownerSetSeqno",
            "type": "u32"
          },
          {
            "name": "threshold",
            "type": "u64"
          },
          {
            "name": "pendingTxs",
            "type": "u64"
          },
          {
            "name": "createdOn",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "Transaction",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "multisig",
            "type": "publicKey"
          },
          {
            "name": "programId",
            "type": "publicKey"
          },
          {
            "name": "accounts",
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
            "name": "signers",
            "type": "bytes"
          },
          {
            "name": "ownerSetSeqno",
            "type": "u32"
          },
          {
            "name": "createdOn",
            "type": "u64"
          },
          {
            "name": "executedOn",
            "type": "u64"
          },
          {
            "name": "operation",
            "type": "u8"
          },
          {
            "name": "keypairs",
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
            "type": "publicKey"
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
      }
    },
    {
      "name": "TransactionDetail",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "title",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          },
          {
            "name": "description",
            "type": {
              "array": [
                "u8",
                512
              ]
            }
          },
          {
            "name": "expirationDate",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "Owner",
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
    }
  ],
  types: [
    {
      "name": "OwnerData",
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
  errors: [
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
      "msg": "Operation overflow"
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
    }
  ]
}

export default idl;

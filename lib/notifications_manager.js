const Promise = require('bluebird');
const remote = require(__dirname+'/remote.js');
const NotificationParser = require(__dirname+'/notification_parser.js');

function RippleNotificationsManager(options) {
  this.remote = options.remote || remote;
};

RippleNotificationsManager.prototype = {
  constructor: RippleNotificationsManager,

  getNotification: function(transactionHash) {
    return new Promise(function(resolve, reject) {
      var account = ''; //request.params.account;
      var identifier = ''; //request.params.identifier
      if (!account) {
        reject(new Error('Missing parameter: account. Must be a valid Ripple Address'));
      }
      function getTransaction(async_callback) {
        transactions.getTransactionHelper(request, response, async_callback);
      };
      function checkLedger(base_transaction, async_callback) {
        server_lib.remoteHasLedger(remote, base_transaction.ledger_index, function(error, remote_has_ledger) {
          if (error) {
            return async_callback(error);
          }
          if (remote_has_ledger) {
            async_callback(null, base_transaction);
          } else {
            reject(new Error('Cannot Get Notification.'));
          }
        });
      };
      function prepareNotificationDetails(base_transaction, async_callback) {
        var notification_details = {
          account:         account,
          identifier:      identifier,
          transaction:     base_transaction
        };
        if (base_transaction.client_resource_id) {
          notification_details.client_resource_id = base_transaction.client_resource_id;
        }
        attachPreviousAndNextTransactionIdentifiers(response, notification_details, async_callback);
      };
      function parseNotificationDetails(notification_details, async_callback) {
        var notification = parseNotification(notification_details);
        async_callback(null, notification);
      };
      var steps = [
        getTransaction,
        checkLedger,
        prepareNotificationDetails,
        parseNotificationDetails
      ];
      async.waterfall(steps, callback);
    });
  },
  _getTransaction: function() {
    return new Promise(function(resolve, reject) {
      Promise.promisify(transactions.getTransactionHelper)(request, response)
      .then(resolve);
      .error(reject);
    });
  },
  _checkLedger: function() {
    return new Promise(function(resolve, reject) {
      return Promise.promisify(server_lib.remoteHasLedger)(remote, base_transaction.ledger_index)
      .then(function(remote_has_ledger) {
        if (remote_has_ledger) {
          resolve(base_transaction);
        } else {
          reject(new Error('Cannot Get Notification.'))
        }
      })
      .error(error);
    });
  },
  _prepareNotificationDetails: function() {
    return new Promise(function(resolve, reject) {
      var notification_details = {
        account:         account,
        identifier:      identifier,
        transaction:     base_transaction
      };
      if (base_transaction.client_resource_id) {
        notification_details.client_resource_id = base_transaction.client_resource_id;
      }
      Promise.promisify(attachPreviousAndNextTransactionIdentifiers)(response, notification_details)
      .then(resolve)
      .error(reject);
    });
  },

  _attachPreviousAndNextTransactionIdentifiers: function(response, notification_details) {
    return new Promise(function(resolve, reject) {
  
      var nextTransactionFinder = new NextTransactionFinder(); 
      var previousTransactionFinder = new PreviousTransactionFinder(); 

      function getAccountTransactionsInBaseTransactionLedger(async_callback) {
        var params = {
          account: notification_details.account,
          ledger_index_min: notification_details.transaction.ledger_index,
          ledger_index_max: notification_details.transaction.ledger_index,
          exclude_failed: false,
          max: 99999999,
          limit: 200 // arbitrary, just checking number of transactions in ledger
        };

        transactions.getAccountTransactions(params, response, async_callback);
      };

      // All we care about is the count of the transactions
      function countAccountTransactionsInBaseTransactionledger(transactions, async_callback) {
        async_callback(null, transactions.length);
      };

      // Query for one more than the num_transactions_in_ledger
      // going forward and backwards to get a range of transactions
      // that will definitely include the next and previous transactions
      function getNextAndPreviousTransactions(num_transactions_in_ledger, async_callback) {
        async.concat([false, true], function(earliest_first, async_concat_callback){
          var params = {
            account: notification_details.account,
            max: num_transactions_in_ledger + 1,
            min: num_transactions_in_ledger + 1,
            limit: num_transactions_in_ledger + 1,
            earliest_first: earliest_first
          };

          // In rippled -1 corresponds to the first or last ledger
          // in its database, depending on whether it is the min or max value
          if (params.earliest_first) {
            params.ledger_index_max = -1;
            params.ledger_index_min = notification_details.transaction.ledger_index;
          } else {
            params.ledger_index_max = notification_details.transaction.ledger_index;
            params.ledger_index_min = -1;
          }

          transactions.getAccountTransactions(params, response, async_concat_callback);

        }, async_callback);

      };

      // Sort the transactions returned by ledger_index and remove duplicates
      function sortTransactions(all_possible_transactions, async_callback) {
        all_possible_transactions.push(notification_details.transaction);

        var transactions = _.uniq(all_possible_transactions, function(tx) {
          return tx.hash;
        });

        // Sort transactions in ascending order (earliest_first) by ledger_index
        transactions.sort(function(a, b) {
          if (a.ledger_index === b.ledger_index) {
            return a.date <= b.date ? -1 : 1;
          } else {
            return a.ledger_index < b.ledger_index ? -1 : 1;
          }
        });

        async_callback(null, transactions);
      };

      // Find the base_transaction amongst the results. Because the
      // transactions have been sorted, the next and previous transactions
      // will be the ones on either side of the base transaction
      function findPreviousAndNextTransactions(transactions, async_callback) {

        // Find the index in the array of the base_transaction
        var base_transaction_index = _.findIndex(transactions, function(possibility) {
          if (possibility.hash === notification_details.transaction.hash) {
            return true;
          } else if (possibility.client_resource_id &&
            (possibility.client_resource_id === notification_details.transaction.client_resource_id ||
            possibility.client_resource_id === notification_details.identifier)) {
            return true;
          } else {
            return false;
          }
        });

        // The previous transaction is the one with an index in
        // the array of base_transaction_index - 1
        if (base_transaction_index > 0) {
          var previous_transaction = transactions[base_transaction_index - 1];
          notification_details.previous_transaction_identifier = (previous_transaction.from_local_db ? previous_transaction.client_resource_id : previous_transaction.hash);
          notification_details.previous_hash = previous_transaction.hash;
        }

        // The next transaction is the one with an index in
        // the array of base_transaction_index + 1
        if (base_transaction_index + 1 < transactions.length) {
          var next_transaction = transactions[base_transaction_index + 1];
          notification_details.next_transaction_identifier = (next_transaction.from_local_db ? next_transaction.client_resource_id : next_transaction.hash);
          notification_details.next_hash = next_transaction.hash;
        }


        async_callback(null, notification_details);
      };

      var steps = [
        getAccountTransactionsInBaseTransactionLedger,
        countAccountTransactionsInBaseTransactionledger,
        getNextAndPreviousTransactions,
        sortTransactions,
        findPreviousAndNextTransactions
      ];

      async.waterfall(steps, callback);
    
    });
  },
  _getAccountTransactionsInBaseTransactionLedger: function(notification_details) {
    return new Promise(function(resolve, reject) {
      var params = {
        account: notification_details.account,
        ledger_index_min: notification_details.transaction.ledger_index,
        ledger_index_max: notification_details.transaction.ledger_index,
        exclude_failed: false,
        max: 99999999,
        limit: 200 // arbitrary, just checking number of transactions in ledger
      };

      transactions.getAccountTransactions(params, response, function(error, transactions) {
        if (error) {
          return reject(error);
        }
        resolve(transactions);
      });
    });
  },
  _countAccountTransactionsInBaseTransactionledger: function(transactions) {
    return new Promise(function(resolve, reject) {
       resolve(transactions.length);
    });
  },
  _getNextAndPreviousTransactions: function() {
    return new Promise(function(resolve, reject) {
      async.concat([false, true], function(earliest_first, async_concat_callback){
        var params = {
          account: notification_details.account,
          max: num_transactions_in_ledger + 1,
          min: num_transactions_in_ledger + 1,
          limit: num_transactions_in_ledger + 1,
          earliest_first: earliest_first
        };
        if (params.earliest_first) {
          params.ledger_index_max = -1;
          params.ledger_index_min = notification_details.transaction.ledger_index;
        } else {
          params.ledger_index_max = notification_details.transaction.ledger_index;
          params.ledger_index_min = -1;
        }
        transactions.getAccountTransactions(params, response, async_concat_callback);
      }, function(error, transactions) {
        if (error) {
          return reject(error);
        }
        resolve(transactions);
      });
    });
  },

  _findPreviousAndNextTransactions: function() {
    return new Promise(function(resolve, reject) {
      var base_transaction_index = _.findIndex(transactions, function(possibility) {
        if (possibility.hash === notification_details.transaction.hash) {
          return true;
        } else if (possibility.client_resource_id &&
          (possibility.client_resource_id === notification_details.transaction.client_resource_id ||
          possibility.client_resource_id === notification_details.identifier)) {
          return true;
        } else {
          return false;
        }
      });
      if (base_transaction_index > 0) {
        var previous_transaction = transactions[base_transaction_index - 1];
        notification_details.previous_transaction_identifier = (previous_transaction.from_local_db ? previous_transaction.client_resource_id : previous_transaction.hash);
        notification_details.previous_hash = previous_transaction.hash;
      }
      if (base_transaction_index + 1 < transactions.length) {
        var next_transaction = transactions[base_transaction_index + 1];
        notification_details.next_transaction_identifier = (next_transaction.from_local_db ? next_transaction.client_resource_id : next_transaction.hash);
        notification_details.next_hash = next_transaction.hash;
      }
      resolve(notification_details);
    });
  },
  _parseNotificationDetails: function() {
    return new Promise(function(resolve, reject) {
      var notification = parseNotification(notification_details);
      resolve(notification);
    });
  },
  _sortTransactions: function(all_possible_transactions) {
    return new Promise(function(resolve, reject) {
      all_possible_transactions.push(notification_details.transaction);
      var transactions = _.uniq(all_possible_transactions, function(tx) {
        return tx.hash;
      });
      transactions.sort(function(a, b) {
        if (a.ledger_index === b.ledger_index) {
          return a.date <= b.date ? -1 : 1;
        } else {
          return a.ledger_index < b.ledger_index ? -1 : 1;
        }
      });
      resolve(transactions);
    });
  },
  _parseNotification: function(notification_details) {
    var notificationParser = new NotificationParser();
    var notification = notificationParser.parse(notification_details);
    return notification;
  }
}

module.exports = RippleNotificationsManager;


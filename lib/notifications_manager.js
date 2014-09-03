const Promise = require('bluebird');
const remote = require(__dirname+'/remote.js');

function RippleNotificationsManager(options) {
  this.remote = options.remote || remote;
};

RippleNotificationsManager.prototype = {
  constructor: RippleNotificationsManager,

  getNotification: fucntion(transactionHash) {
    return new Promise(function(resolve, reject) {});
  },
  _getTransaction: function() {
    return new Promise(function(resolve, reject) {});
  },
  _checkLedger: function() {
    return new Promise(function(resolve, reject) {});
  },
  _prepareNotificationDetails: function() {
    return new Promise(function(resolve, reject) {});
  },
  _attachPreviousAndNextTransactionIdentifiers: function() {
    return new Promise(function(resolve, reject) {});
  },
  _getAccountTransactionsInBaseTransactionLedger: function() {
    return new Promise(function(resolve, reject) {});
  },
  _countAccountTransactionsInBaseTransactionledger: function() {
    return new Promise(function(resolve, reject) {});
  },
  _getNextAndPreviousTransactions: function() {
    return new Promise(function(resolve, reject) {});
  },
  _findPreviousAndNextTransactions: function() {
    return new Promise(function(resolve, reject) {});
  },
  _sortTransactions: function() {
    // synchronous
  },
  _parseNotificationDetails: function() {
    // syncrhonous
  },
  _parseNotification: function() {
    // synchronous
  }
}

module.exports = RippleNotificationsManager;


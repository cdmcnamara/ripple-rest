var assert = require('assert');
var ripple = require('ripple-lib');
var testutils = require('./testutils');
var fixtures = require('./fixtures').payments;
var errors = require('./fixtures').errors;
var addresses = require('./fixtures').addresses;
var requestPath = fixtures.requestPath;

describe('get payments', function() {
  var self = this;

  //self.wss: rippled mock
  //self.app: supertest-enabled REST handler

  beforeEach(testutils.setup.bind(self));
  afterEach(testutils.teardown.bind(self));

  it('/accounts/:account/payments/:identifier', function(done) {
    self.wss.once('request_tx', function(message, conn) {
      assert.strictEqual(message.command, 'tx');
      assert.strictEqual(message.transaction, fixtures.VALID_TRANSACTION_HASH);
      conn.send(fixtures.transactionResponse(message));
    });

    self.app
    .get(requestPath(addresses.VALID) + '/' + fixtures.VALID_TRANSACTION_HASH)
    .expect(testutils.checkStatus(200))
    .expect(testutils.checkHeaders)
    .expect(testutils.checkBody(fixtures.RESTTransactionResponse))
    .end(done);
  });

  it('/accounts/:account/payments/:identifier -- invalid identifier', function(done) {
    self.wss.once('request_tx', function(message, conn) {
      assert(false, 'Should not request transaction');
    });

    self.app
    .get(requestPath(addresses.VALID) + '/' + fixtures.INVALID_TRANSACTION_HASH)
    .expect(testutils.checkStatus(404)) //XXX Should be 400
    .expect(testutils.checkHeaders)
    .expect(testutils.checkBody(errors.RESTInvalidTransactionHash))
    .end(done);
  });
});

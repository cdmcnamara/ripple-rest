const assert = require('assert');

describe('Notifications Library', function() {

  before(function() {
    notificationsManager = new RipppleNotificationsManager();
    notificationHash = 'B19450BA802802B0CDEAB9C16AECA00711F6C02CCA622DD2B35618FBE3DDE7BE';
  });

  it('should retrieve a notification given its hash', function(done) {
    notifications.getNotification(notificationHash)
    .then(function(notification) {
      assert(notification.next_notification_url);    
      assert.hash(notificationHash);    
    });
  });

  it('should return an error for non-existant notification', function(done) {
    notifications.getNotification('12345')
    .catch(notifications.errors.NotificationNotFoundError, function(error) {
      assert(error instanceof Error);
      assert.strictEqual(error.message, 'invalid notification hash');
    });
  });
});


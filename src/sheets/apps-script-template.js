/**
 * Pulsereach — Google Apps Script Autonomous Sync & 15-Minute Deferred Lead Scheduler
 *
 * HOW TO INSTALL IN GOOGLE SHEETS:
 * 1. Open your Google Sheet (https://docs.google.com/spreadsheets/d/...)
 * 2. In the top menu, click Extensions > Apps Script
 * 3. Replace the contents of Code.gs with this script
 * 4. Replace WEBHOOK_SECRET with your secret from your .env file
 * 5. Click Save (Disk icon)
 * 6. Set up the installable trigger:
 *    - Click Triggers (alarm clock icon on left sidebar)
 *    - Click "+ Add Trigger" (bottom right)
 *    - Choose which function to run: `onSheetChange`
 *    - Select event source: `From spreadsheet`
 *    - Select event type: `On change`
 *    - Click Save and grant permissions!
 */

const PULSEREACH_WEBHOOK_URL = 'https://YOUR_VERCEL_PROJECT.vercel.app/api/trigger';
const WEBHOOK_SECRET = 'YOUR_WEBHOOK_SECRET'; // Replace with WEBHOOK_SECRET from your .env file

/**
 * Triggered automatically by Google Sheets on any edit, row paste (Gemini Spark), or change.
 */
function onSheetChange(e) {
  triggerPulsereach('sheet_change');
}

/**
 * Schedules a 100% free one-time automated 15-minute cooldown trigger.
 * When the 15 minutes elapse, Google Apps Script will automatically wake up
 * and trigger Pulsereach to deliver the next job lead to Telegram.
 */
function schedule15MinCooldown() {
  clearDeferredTriggers();
  ScriptApp.newTrigger('onDeferredCooldownWakeup')
    .timeBased()
    .after(15 * 60 * 1000) // 15 minutes in milliseconds
    .create();
  Logger.log('✅ Scheduled 15-minute cooldown trigger.');
}

/**
 * Invoked automatically by Google's cloud servers after 15 minutes.
 */
function onDeferredCooldownWakeup() {
  Logger.log('⏰ 15-minute cooldown elapsed. Triggering Pulsereach for next job lead...');
  clearDeferredTriggers();
  triggerPulsereach('deferred_15m_cooldown');
}

/**
 * Clears any pending deferred triggers to avoid duplicate triggers.
 */
function clearDeferredTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onDeferredCooldownWakeup') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

/**
 * Sends authenticated webhook POST request to Pulsereach Vercel /api/trigger
 */
function triggerPulsereach(source) {
  try {
    var payload = JSON.stringify({
      source: source || 'apps_script',
      timestamp: new Date().toISOString(),
    });

    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-webhook-secret': WEBHOOK_SECRET,
      },
      payload: payload,
      muteHttpExceptions: true,
    };

    var response = UrlFetchApp.fetch(PULSEREACH_WEBHOOK_URL, options);
    Logger.log('Pulsereach Response (' + response.getResponseCode() + '): ' + response.getContentText());
  } catch (err) {
    Logger.log('Error triggering Pulsereach: ' + err.toString());
  }
}

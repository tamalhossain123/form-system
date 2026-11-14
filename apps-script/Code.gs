/**
 * Form System - Google Sheets webhook
 * ===================================
 * Appends every response submitted to a Form System form as a row in
 * this Google Sheet. One tab per form (named after the form's title);
 * columns are created automatically from the questions.
 *
 * HOW TO DEPLOY (one time, about 2 minutes):
 *   1. Open the Google Sheet that should receive the responses.
 *   2. In the menu, click Extensions > Apps Script.
 *   3. Delete any code already in the editor and paste this whole file in.
 *   4. Click Deploy > New deployment.
 *   5. Choose the deployment type "Web app".
 *   6. Set "Execute as" to: Me.
 *   7. Set "Who has access" to: Anyone.
 *   8. Click Deploy and approve the permission prompts.
 *   9. Copy the Web App URL (it ends in /exec).
 *  10. In the Form System app, open the form, go to Settings, and paste
 *      the URL into the "Google Sheets" field.
 *
 * After that, every new response is also appended to the sheet.
 * (If you edit this script later, deploy again with
 * Deploy > Manage deployments > Edit > Version: New version, otherwise
 * the old version keeps running.)
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var tabName = sanitizeTabName(data.formTitle);
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
    }

    var answers = data.answers || {};
    var keys = Object.keys(answers);

    // Read the current header row (row 1).
    var lastCol = sheet.getLastColumn();
    var headers = [];
    if (lastCol > 0) {
      headers = sheet
        .getRange(1, 1, 1, lastCol)
        .getValues()[0]
        .map(function (h) {
          return String(h || '');
        });
      while (headers.length && headers[headers.length - 1] === '') {
        headers.pop();
      }
    }

    // Ensure "Submitted At" plus one column per answer key, in payload order.
    var changed = false;
    if (headers.indexOf('Submitted At') === -1) {
      headers.unshift('Submitted At');
      changed = true;
    }
    keys.forEach(function (key) {
      if (headers.indexOf(key) === -1) {
        headers.push(key);
        changed = true;
      }
    });
    if (changed || sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    // Build the row in header order and append it.
    var row = headers.map(function (h) {
      if (h === 'Submitted At') return data.submittedAt || '';
      var v = answers[h];
      return v === undefined || v === null ? '' : String(v);
    });
    sheet.appendRow(row);

    return ContentService.createTextOutput(
      JSON.stringify({ result: 'success' })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ result: 'error', message: String(err) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput(
    'Form System Sheets webhook is running'
  );
}

/** Sheet tab names: max 100 chars, and none of  \ / ? * [ ] :  */
function sanitizeTabName(name) {
  var clean = String(name || '')
    .replace(/[\\\/\?\*\[\]:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);
  return clean || 'Responses';
}

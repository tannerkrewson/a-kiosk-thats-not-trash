/* 
SHEETS CODE 
https://developers.google.com/sheets/api/quickstart/js
*/

// Client ID and API key from the Developer Console
var CLIENT_ID = '456390951586-96qcaqi78249qdb4m89hac6ulu11ogbq.apps.googleusercontent.com';
var API_KEY = 'AIzaSyD8jd0tPMYX6sR3-oLbnFXlKpA8tbQB96s';

// Array of API discovery doc URLs for APIs used by the quickstart
var DISCOVERY_DOCS = ["https://sheets.googleapis.com/$discovery/rest?version=v4"];

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
var SCOPES = "https://www.googleapis.com/auth/spreadsheets";

var authorizeButton = document.getElementById('sheets-login');
//var signoutButton = document.getElementById('signout_button');

/**
 *  On load, called to load the auth2 library and API client library.
 */
function handleClientLoad() {
  gapi.load('client:auth2', initClient);
}

/**
 *  Initializes the API client library and sets up sign-in state
 *  listeners.
 */
function initClient() {
  gapi.client.init({
    apiKey: API_KEY,
    clientId: CLIENT_ID,
    discoveryDocs: DISCOVERY_DOCS,
    scope: SCOPES
  }).then(function () {
    // Listen for sign-in state changes.
    gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

    // Handle the initial sign-in state.
    updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    authorizeButton.onclick = handleAuthClick;
    //signoutButton.onclick = handleSignoutClick;
  }, function(error) {
    appendPre(JSON.stringify(error, null, 2));
  });
}

/*
CUSTOM CODE
*/

/**
 *  Called when the signed in status changes, to update the UI
 *  appropriately. After a sign-in, the API is called.
 */
function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    showAfterLoad('#sheet-setup');
  } else {
    showAfterLoad('#auth');
  }
}

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick(event) {
  showLoading();
  gapi.auth2.getAuthInstance().signIn();
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick(event) {
  gapi.auth2.getAuthInstance().signOut();
}

/**
 * Append a pre element to the body containing the given message
 * as its text node. Used to display the results of the API call.
 *
 * @param {string} message Text to be placed in pre element.
 */
function appendPre(message) {
  var pre = document.getElementById('content');
  var textContent = document.createTextNode(message + '\n');
  pre.appendChild(textContent);
}

/**
 * Print the names and majors of students in a sample spreadsheet:
 * https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 */
function listMajors() {
  gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
    range: 'Class Data!A2:E',
  }).then(function(response) {
    var range = response.result;
    if (range.values.length > 0) {
      appendPre('Name, Major:');
      for (i = 0; i < range.values.length; i++) {
        var row = range.values[i];
        // Print columns A and E, which correspond to indices 0 and 4.
        appendPre(row[0] + ', ' + row[4]);
      }
    } else {
      appendPre('No data found.');
    }
  }, function(response) {
    appendPre('Error: ' + response.result.error.message);
  });
}

function hideAll() {
    $('#auth').hide();
    $('#sheet-setup').hide();
    $('#ticket-entry').hide();
}

function showLoading() {
    hideAll();
    $('#loading').show();
}

function showAfterLoad(id) {
    $('#loading').hide();
    $(id).show();
}

$("#sheet-setup").on('submit', function( event ) {
    event.preventDefault();
    showLoading();

    var sheetId = $('#sheet-link').val().split('/')[5];
    var studentPrice = $('#student-price').val();
    var gaPrice = $('#ga-price').val();

    checkIfSheetValid(sheetId).then(function (response) {
        // the sheet is a real google sheet!
        showAfterLoad('#ticket-entry');

        prepTicketEntry(sheetId, studentPrice, gaPrice);
    }).catch(function(err) {
        alert('Bad google sheet');
        console.log(err);
        
    });
});

function checkIfSheetValid(spreadsheetId) {
    return gapi.client.sheets.spreadsheets.get({
        spreadsheetId 
    });
}

function prepTicketEntry(sheetId, studentPrice, gaPrice) {
    $('#ticket-entry').off('submit');
    $('#ticket-entry').on('submit', function() {
        event.preventDefault();
        showLoading();

        var isStudentRadioSelected = $('#student-radio').val();

        if (isStudentRadioSelected) {
            // if it's a student ticket, grab the banner id
            var bannerId = $('#banner-id').val();

            // make sure this student has not already purchased a ticket
            checkBannerId(sheetId, bannerId);

            writeStudentToSpreadsheet(sheetId, bannerId).then(function () {
                alert('student ticket bought!');
                showAfterLoad('#ticket-entry');
            }).catch(function (err) {
                console.log(err);
                
                alert('banner id already used');
                showAfterLoad('#ticket-entry');
            });
        } else {
            writeGaToSpreadsheet(sheetId).then(function () {
                alert('ga ticket bought!');
                showAfterLoad('#ticket-entry');
            });
        }
    });
}

function checkBannerId(sheetId, bannerId) {
    return true;
}

function writeStudentToSpreadsheet(spreadsheetId, bannerId) {
    return writeRowToSheet([(new Date()).toUTCString(), 1, 'Student', bannerId], spreadsheetId);
}

function writeGaToSpreadsheet(sheetId) {
    return writeRowToSheet([(new Date()).toUTCString(), 1, 'GA'], spreadsheetId);
}

function writeRowToSheet(row, spreadsheetId) {
    return gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Sheet1',
        valueInputOption: 'USER_ENTERED',
        resource: {
            majorDimension: "ROWS",
            values: [ row ]
        }
    });
};
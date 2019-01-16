/* 
SHEETS CODE 
https://developers.google.com/sheets/api/quickstart/js
*/

// Client ID and API key from the Developer Console
const CLIENT_ID = '456390951586-96qcaqi78249qdb4m89hac6ulu11ogbq.apps.googleusercontent.com';
const API_KEY = 'AIzaSyD8jd0tPMYX6sR3-oLbnFXlKpA8tbQB96s';

// Array of API discovery doc URLs for APIs used by the quickstart
const DISCOVERY_DOCS = ["https://sheets.googleapis.com/$discovery/rest?version=v4"];

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";

let authorizeButton = document.getElementById('sheets-login');
//let signoutButton = document.getElementById('signout_button');

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
	}).then(() => {
		// Listen for sign-in state changes.
		gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

		// Handle the initial sign-in state.
		updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
		authorizeButton.onclick = handleAuthClick;
		//signoutButton.onclick = handleSignoutClick;
	}, error => {
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
	let pre = document.getElementById('content');
	let textContent = document.createTextNode(`${message}\n`);
	pre.appendChild(textContent);
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

$("#sheet-setup").on('submit', event => {
	event.preventDefault();
	showLoading();

	let sheetId = $('#sheet-link').val().split('/')[5];
	let studentPrice = $('#student-price').val();
    let gaPrice = $('#ga-price').val();
    
    let info = { sheetId, studentPrice, gaPrice };

	checkIfSheetValid(sheetId).then(response => {
		// the sheet is a real google sheet!
		prepTicketEntry(info)
	}).catch(err => {
		Swal('Invalid Google Sheet!', '', 'error');
		console.log(err);
	});
});

function checkIfSheetValid(spreadsheetId) {
	return gapi.client.sheets.spreadsheets.get({
		spreadsheetId
	});
}

function prepTicketEntry(info) {
    showAfterLoad('#ticket-entry');

    // clear info of previous ticket sale
    info.bannerId = null;
    info.quantity = null;
    info.ticketType = null;

	$('#ticket-entry').off('submit');
	$('#ticket-entry').on('submit', () => {
		event.preventDefault();
		showLoading();

        let isStudentRadioSelected = $('#student-radio').val();
        
        info.ticketType = isStudentRadioSelected ? 'student' : 'GA';

		if (isStudentRadioSelected) {
            sellStudentTicket(info);
		} else {
			writeGaToSpreadsheet(info.sheetId).then(() => {
				Swal('GA ticket good!', 'woohoo', 'success');
				prepTicketEntry(info)
			});
		}
	});
}

function sellStudentTicket(info) {
    // if it's a student ticket, grab the banner id
    const bannerId = $('#banner-id').val();

    // TODO: Validate banner id format
    info.bannerId = bannerId;
    info.quantity = 1;

    // make sure this student has not already purchased a ticket
    return checkBannerId(info.sheetId, info.bannerId)

        // ran when banner id is verfied to not have been used before
        .then(() => confirmPayment(info))

        // ran after payment is either confirmed or denied
        .then(() => prepTicketEntry(info));
}

function confirmPayment(info) {
    const totalPrice = info.quantity * info.studentPrice;
    const plural = info.quantity !== 1 ? 's' : '';

    // TODO: if tickets are free, disable confirmation

    return Swal({
        title: `Ask them for $${totalPrice}.`,
        text: `They will receive ${info.quantity} ${info.ticketType} ticket${plural}. If they don't have the money, click cancel.`,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'I got the money!'
    })

        .then( res => {
            const didUserConfirmPayment = res.value;
            if (didUserConfirmPayment) {
                return logTicketSale(info);
            }
        })

        .catch(err => {
            console.error(err);
            errorNoTicket(err);
        });
}

function checkBannerId(sheetId, enteredBannerId) {
    return readBannerIdRow(sheetId).catch(err => console.log(err))
        // grab the error message text from the api json
        .catch(({result}) => Promise.reject(result.error.message)) 

        // check if the entered banner id is in the array
        .then(previousBannerIds => {
            if (previousBannerIds.includes(enteredBannerId)) {
                return Promise.reject('The banner ID has already been used.');
            } else {
                // it hasn't been used before
                return true;
            }
	    });
}

function logTicketSale(info) {
    const plural = info.quantity !== 1 ? 's' : '';

    return writeStudentToSpreadsheet(info.sheetId, info.bannerId)

        .then(() => Swal(
            `Give them ${info.quantity} ${info.ticketType} ticket${info.plural}!`,
            'yeet',
            'success'
        ))

        // ran if the api throws an error
        .catch(res => {
            console.error(res);

            // grab the api's error message
            throw res.result.error.message;
        });
}

function errorNoTicket(errorMessage) {
	Swal('Don\'t give them a ticket!', errorMessage, 'error');
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
			values: [row]
		}
	});
};

function readBannerIdRow(spreadsheetId) {
	return gapi.client.sheets.spreadsheets.values.get({
		spreadsheetId,
		range: 'Sheet1!D2:D',
		resource: {
			majorDimension: "COLUMNS"
        }
    })

    // get an array of all banner ids from the response
    .then(res => {
        // handle empty spreadsheet because values won't exist
        if (res.result.hasOwnProperty('values')) {
            return res.result.values[0];
        } else {
            return [];
        }
    });
}
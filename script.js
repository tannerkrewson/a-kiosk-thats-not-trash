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


/*
CUSTOM CODE
*/

const TICKET_TYPE_RADIO_GROUP = $('input[type=radio][name=ticket-type]');

// ran when sign in the user upon button click.
function handleAuthClick(event) {
	showLoading();
	gapi.auth2.getAuthInstance().signIn();
}

// ran when signout button is clicked (there isn't one right now)
function handleSignoutClick(event) {
	gapi.auth2.getAuthInstance().signOut();
}

// ran when google is logged in or out
function updateSigninStatus(isSignedIn) {
	if (isSignedIn) {
		showAfterLoad('#sheet-setup');
	} else {
		showAfterLoad('#auth');
	}
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

TICKET_TYPE_RADIO_GROUP.on('change', () => {
    const selectedTicketType = getSelectedTicketType();

    if (selectedTicketType === 'student') {
        $('#student-options').show();
        $('#ga-options').hide();
    } else if (selectedTicketType === 'GA') {
        $('#student-options').hide();
        $('#ga-options').show();
    }
    
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
        
        info.ticketType = getSelectedTicketType();

		if (info.ticketType === 'student') {
            sellStudentTicket(info);
		} else if (info.ticketType === 'GA') {
			sellGATickets(info);
		} else {
            Swal('Bad ticket type selected: ' + info.ticketType);
        }
	});
}

function sellStudentTicket(info) {
    const bannerId = $('#banner-id').val();

    // TODO: Validate banner id format
    info.bannerId = bannerId;
    info.quantity = 1;

    // make sure this student has not already purchased a ticket
    return checkBannerId(info.sheetId, info.bannerId)

        // ran when banner id is verfied to not have been used before
        .then(() => confirmPayment(info))

        // show error before resetting
        .catch(err => errorNoTicket(err))

        // ran after payment is either confirmed or denied
        .then(() => prepTicketEntry(info));
}

function sellGATickets(info) {
    const quantity = $('#quantity').val();

    //TODO: Verify quanity
    info.quantity = quantity;

    return confirmPayment(info)

        // show error before resetting
        .catch(err => errorNoTicket(err))

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

    return appendPurchaseToSheet(info)

        .then(() => Swal(
            `Give them ${info.quantity} ${info.ticketType} ticket${plural}!`,
            'The purchase has been logged in the spreadsheet. Yeet.',
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

function appendPurchaseToSheet(info) {
    let now = new Date();
    const weekday = now.toLocaleString('en-US', { weekday: 'short' });
    const timestamp = weekday + ' ' + now.toLocaleString();

    const newRow = [
        timestamp,
        info.quantity,
        info.ticketType,
        info.bannerId || 'n/a'
    ];

	return gapi.client.sheets.spreadsheets.values.append({
		spreadsheetId: info.sheetId,
		range: 'Sheet1',
		valueInputOption: 'USER_ENTERED',
		resource: {
			majorDimension: "ROWS",
			values: [newRow]
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

function getSelectedTicketType() {
    return TICKET_TYPE_RADIO_GROUP.filter(':checked')[0].value;
}
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
        Swal('Try refreshing the page', JSON.stringify(error, null, 2), 'error');
	});
}


/*
CUSTOM CODE
*/

const SHEET_NAME = 'Ticket Sales';

const TICKET_TYPE_RADIO_GROUP = $('input[type=radio][name=ticket-type]');
const TICKETS_TO_OFFER_CHECK_GROUP = $('input[type=checkbox][name=tickets-to-offer]');
const ALL_TICKET_TYPES = ['Student', 'Guest', 'GA'];

// ran when sign in the user upon button click.
function handleAuthClick(event) {
	showLoading();
	gapi.auth2.getAuthInstance().signIn();
}

// ran when signout button is clicked (there isn't one right now)
function handleSignoutClick(event) {
    showLoading();
	gapi.auth2.getAuthInstance().signOut();
}

// ran when google is logged in or out
function updateSigninStatus(isSignedIn) {
    hideAll();
	if (isSignedIn) {
        savedInfo = checkForSavedInfoFromCookies();
        if (savedInfo) {
            // if the cookies had data, make sure it's still good
            validateInfo(savedInfo);
        } else {
            // there's no saved info, so the user must enter it
            showScreen('#sheet-setup');
        }
	} else {
        // if the login failed, show the used the login screen again
		showScreen('#auth');
	}
}

function hideAll() {
	$('#auth').hide();
	$('#sheet-setup').hide();
    $('#ticket-entry').hide();
    $('#loading').hide();
}

function resetTicketEntry() {
    $('#banner-id-input').val('');
    $('#quantity-input').val('');
}

function showLoading() {
	hideAll();
	$('#loading').show();
}

function showScreen(id) {
	hideAll();
    $(id).show();
}

$("#sheet-setup").on('submit', event => {
	event.preventDefault();
	showLoading();

    let sheetLink = $('#sheet-link').val();
    let sheetId = sheetLink.split('/')[5];
    
    let ticketTypesToOffer = getSelectedTicketsToOffer();

    let studentPrice = $('#student-price').val();
    let guestPrice = $('#guest-price').val();
    let gaPrice = $('#ga-price').val();

    let guestMax = $('#guest-max').val();
    
    let info = { sheetLink, sheetId, studentPrice, guestPrice, gaPrice, ticketTypesToOffer, guestMax };

    // if the info is good, this will show ticket entry ui
    validateInfo(info);
});

function checkForSavedInfoFromCookies() {
    let savedInfo = Cookies.getJSON('info');
    if (!savedInfo) return false;
    
    $('#sheet-link').val(savedInfo.sheetLink);
	$('#student-price').val(savedInfo.studentPrice);
    $('#ga-price').val(savedInfo.gaPrice);

    return savedInfo;
}

function validateInfo(info) {
    checkIfSheetValid(info.sheetId).then(response => {
        // these run if the sheet is, in fact, a real google sheet
        Cookies.set('info', info);
		prepTicketEntry(info)
	}).catch(err => {
        console.error(err);
		Swal('Invalid Google Sheet!', err.result.error.message, 'error');
        showScreen('#sheet-setup');
	});
}
 
TICKET_TYPE_RADIO_GROUP.on('change', () => {
    const selectedTicketType = getSelectedTicketType();

    if (selectedTicketType === 'Student') {
        $('#banner-id').show();
        $('#quantity').hide();
        $('#guest-ticket-info').hide();

        $('#banner-id-input').focus();
    } else if (selectedTicketType === 'Guest') {
        $('#banner-id').show();
        $('#quantity').show();
        $('#guest-ticket-info').show();

        $('#banner-id-input').focus();
    } else if (selectedTicketType === 'GA') {
        $('#banner-id').hide();
        $('#quantity').show();
        $('#guest-ticket-info').hide();

        $('#quantity-input').focus();
    }
    
});

TICKETS_TO_OFFER_CHECK_GROUP.on('change', () => {
    const selectedTicketTypes = getSelectedTicketsToOffer();

    for (const ticketType of ALL_TICKET_TYPES) {
        const selector = `#${ticketType.toLowerCase()}-options`;
        if (selectedTicketTypes.includes(ticketType)) {
            $(selector).show();
        } else {
            $(selector).hide();
        }
    }    
});

$('#settings').on('click', () => showScreen('#sheet-setup'));

function checkIfSheetValid(spreadsheetId) {
    // also makes sure the SHEET_NAME tab is created
	return gapi.client.sheets.spreadsheets.get({
		spreadsheetId
	}).then((res) => {
        let sheetList = res.result.sheets;

        const previousTicketLogExists = checkIfPreviousTicketLogExists(sheetList);
        if (previousTicketLogExists) return res;

        const isNewSpreadsheet = sheetList.length === 1 && sheetList[0].properties.title === 'Sheet1';
        
        if (isNewSpreadsheet) return renameDefaultSheet(spreadsheetId, sheetList[0].properties.sheetId);

        return createTicketLogSheet(spreadsheetId);
    });
}

function checkIfPreviousTicketLogExists (sheetList) {
    for (let sheet of sheetList) {
        if (sheet.properties.title === SHEET_NAME) {
            return true;
        }
    }
    return false;
}

function renameDefaultSheet(spreadsheetId, defaultSheetId) {
    return spreadsheetBatchUpdate(spreadsheetId, [
        {
            updateSheetProperties: {
                properties: {
                    sheetId: defaultSheetId,
                    title: SHEET_NAME,
                },
                fields: "title",
            }
        }
    ]).then(() => appendHeader(spreadsheetId));
}

function createTicketLogSheet(spreadsheetId) {
    return spreadsheetBatchUpdate(spreadsheetId, [
        {
            addSheet: {
                properties:{
                    title: SHEET_NAME
                }
            } 
        }
    ]).then(() => appendHeader(spreadsheetId));
}

function spreadsheetBatchUpdate(spreadsheetId, requests) {
    return gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests }
	});
}

function prepTicketEntry(info) {
    showScreen('#ticket-entry');
    resetTicketEntry();

    showTicketTypes(info.ticketTypesToOffer);
    checkSelectedTicketTypes(info.ticketTypesToOffer);

    // sometimes the form submit button tries to take focus,
    // so grab it again for good measure after .5 seconds
    setTimeout(() => $('#banner-id-input').focus(), 500);
    
	$('#ticket-entry').off('submit');
	$('#ticket-entry').on('submit', () => {
		event.preventDefault();
        showLoading();
        
        // get new info from inputs
        info.bannerId = $('#banner-id-input').val();
        info.quantity = $('#quantity-input').val();
        info.ticketType = getSelectedTicketType();

		if (info.ticketType === 'Student') {
            sellStudentTicket(info);
		} else if (info.ticketType === 'Guest') {
            sellGuestTickets(info);
        } else if (info.ticketType === 'GA') {
			sellGATickets(info);
		} else {
            Swal('Bad ticket type selected: ' + info.ticketType)
                .then(() => prepTicketEntry(info));
        }
	});
}

function sellStudentTicket(info) {
    
    // student can only buy themself one ticket
    info.quantity = 1;

    return verifyAndNormalizeBannerId(info)

        // make sure this student has not already purchased a ticket
        .then(() => checkBannerId(info.sheetId, info.bannerId))

        // tell the user how much money to take from customer,
        // and log the ticket sale to the spreadsheet
        .then(() => confirmPayment(info))

        // show error before resetting
        .catch(err => errorNoTicket(err))

        // ran after payment is either confirmed or denied
        .then(() => prepTicketEntry(info));
}

function sellGuestTickets(info) {
    return verifyAndNormalizeBannerId(info)
        .then(() => ensureIdIsAllowedMoreTickets(info))

        // tell the user how much money to take from customer,
        // and log the ticket sale to the spreadsheet
        .then(() => confirmPayment(info))

        // show error before resetting
        .catch(err => errorNoTicket(err))

        // ran after payment is either confirmed or denied
        .then(() => prepTicketEntry(info));
}

function sellGATickets(info) {
    return confirmPayment(info)

        // show error before resetting
        .catch(err => errorNoTicket(err))

        // ran after payment is either confirmed or denied
        .then(() => prepTicketEntry(info));
}

function confirmPayment(info) {
    const ticketPrice = getTicketPrice(info);
    const totalCost = ticketPrice * info.quantity;

    // if tickets are free, skip confirmation
    if (totalCost === 0) {
        return logTicketSale(info);
    }

    const plural = info.quantity !== 1 ? 's' : '';

    return Swal({
        title: `Ask them for $${totalCost}.`,
        text: `They will receive ${info.quantity} ${info.ticketType} ticket${plural} at $${ticketPrice} per ticket.`,
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

function getTicketPrice(info) {
    if (info.ticketType === 'Student') {
        return info.studentPrice;
    }

    if (info.ticketType === 'Guest') {
        return info.guestPrice;
    }

    return info.gaPrice;
}

function checkBannerId(sheetId, enteredBannerId) {
    return getAllBannerIds(sheetId).catch(err => console.error(err))
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

function verifyAndNormalizeBannerId(info) {
    if (info.bannerId.length !== 9) {
        return Promise.reject('The banner ID is not 9 digits long.');
    }

    info.bannerId = info.bannerId.replace(/^0+/, ''); // remove leading zeros
    return Promise.resolve();
}

function ensureIdIsAllowedMoreTickets(info) {
    return getAllPurchases(info.sheetId).then((allPurchases) => {
        console.log(info);
        console.log(allPurchases);

        let numberOfGuestTicketsThisPersonHasAlreadyPurchased = 0;

        for (let i = 0; i < allPurchases[0].length; i++) {
            const ticketType = allPurchases[0][i];
            const bannerId = allPurchases[1][i];
            const quantity = parseInt(allPurchases[2][i]);

            // if the purchase was made by the same person trying to
            // purchase more guest tickets now
            if (ticketType === 'Guest' && info.bannerId === bannerId) {
                numberOfGuestTicketsThisPersonHasAlreadyPurchased += quantity;
            }
        }

        let numberOfAllowedGuestTicketsRemainingForThisPerson 
            = parseInt(info.guestMax) - numberOfGuestTicketsThisPersonHasAlreadyPurchased;

        // if the number of tickets they are trying to buy is greater than
        // the number of tickets they are still allowed to buy, don't let em
        if (parseInt(info.quantity) > numberOfAllowedGuestTicketsRemainingForThisPerson) {
            return Promise.reject(
                'This person has already bought '
                + numberOfGuestTicketsThisPersonHasAlreadyPurchased
                + ' guest tickets.<br>Each student is only allowed '
                + info.guestMax
                + ' guest tickets.');
        }

        return Promise.resolve();
        
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
    console.error(errorMessage);
    
	Swal('Don\'t give them a ticket!', errorMessage, 'error');
}

function appendPurchaseToSheet(info) {
    let now = new Date();
    const weekday = now.toLocaleString('en-US', { weekday: 'short' });
    const timestamp = weekday + ' ' + now.toLocaleString();

    const ticketPrice = info.ticketType === 'Student' ? info.studentPrice : info.gaPrice;
    const totalCost = ticketPrice * info.quantity;

    const newRow = [
        timestamp,
        info.ticketType,
        info.bannerId || 'n/a',
        info.quantity,
        '$' + ticketPrice,
        '$' + totalCost
    ];

	return appendRow(info.sheetId, newRow);
};

function appendHeader(spreadsheetId) {
    return appendRow(spreadsheetId, ['Timestamp', 'Type', 'Banner ID', 'Quantity', 'Ticket Price', 'Total']);
}

function appendRow(spreadsheetId, newRow) {
    return gapi.client.sheets.spreadsheets.values.append({
		spreadsheetId,
		range: SHEET_NAME,
		valueInputOption: 'USER_ENTERED',
		resource: {
			majorDimension: "ROWS",
			values: [newRow]
		}
	});
}

// gets a lit of all banner ids that have been used to make a ticket purchase
function getAllBannerIds(spreadsheetId) {
    return readRangeFromSheet(spreadsheetId, 'C2:C')
        // strip the container array
        .then((res) => res[0]);
}

function getAllPurchases(spreadsheetId) {
	return readRangeFromSheet(spreadsheetId, 'B2:D');
}

function readRangeFromSheet(spreadsheetId, rangeToRead) {
    return gapi.client.sheets.spreadsheets.values.get({
		spreadsheetId,
		range: SHEET_NAME + '!' + rangeToRead,
		resource: {
			majorDimension: "COLUMNS"
        }
    })
        // get an array of all banner ids from the response
        .then(res => {
            // handle empty spreadsheet because values won't exist
            if (res.result.hasOwnProperty('values')) {
                return res.result.values;
            } else {
                return [[]];
            }
        });
}

function getSelectedTicketsToOffer() {
    let checkedBoxes = TICKETS_TO_OFFER_CHECK_GROUP.filter(':checked');
    let result = [];

    // strip all the jquery junk
    // result will just be an array of the ticket types as strings
    for (let box of checkedBoxes) {
        result.push(box.defaultValue);
    }
    return result;
}

function getSelectedTicketType() {
    return TICKET_TYPE_RADIO_GROUP.filter(':checked')[0].value;
}

function showTicketTypes(ticketTypesToShow) {
    let first = false;
    for (const ticketType of ALL_TICKET_TYPES) {
        const selector = `#${ticketType.toLowerCase()}-radio`;
        if (ticketTypesToShow.includes(ticketType)) {
            $(selector).parent().show();

            // make sure that the first visible ticket type is selected by default
            if (!first) {
                // .change ensures the events attached to checking the box fire
                $(selector).prop("checked", true).change();
                first = true;
            }
        } else {
            $(selector).parent().hide();
        }
    }
}

function checkSelectedTicketTypes(ticketTypesToCheck) {
    let first = false;
    for (const ticketType of ALL_TICKET_TYPES) {
        const selector = `#${ticketType.toLowerCase()}-check`;
        if (ticketTypesToCheck.includes(ticketType)) {
            $(selector).prop("checked", true).change();
        } else {
            $(selector).prop("checked", false).change();
        }
    }
}
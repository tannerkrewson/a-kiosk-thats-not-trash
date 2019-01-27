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

let auth2;

let authorizeButton = document.getElementById('sheets-login');
let signoutButton = document.getElementById('sheets-logout');

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
        auth2 = gapi.auth2.getAuthInstance();

		// Listen for sign-in state changes.
		auth2.isSignedIn.listen(updateSigninStatus);

        // Handle the initial sign-in state.
		updateSigninStatus(auth2.isSignedIn.get());
		authorizeButton.onclick = handleAuthClick;
		signoutButton.onclick = handleSignoutClick;
	}, error => {
        Swal('Try refreshing the page', JSON.stringify(error, null, 2), 'error');
	});
}


/*
CUSTOM CODE
*/

const SHEET_NAME = 'Ticket Sales';

const TICKET_TYPE_RADIO_GROUP = $('a[name=ticket-type]');
const TICKETS_TO_OFFER_CHECK_GROUP = $('input[type=checkbox][name=tickets-to-offer]');
const ALL_TICKET_TYPES = ['Student', 'Guest', 'GA'];

// ran when sign in the user upon button click.
function handleAuthClick(event) {
	showLoading();
    auth2.signIn();
}

// ran when signout button is clicked (there isn't one right now)
function handleSignoutClick(event) {
    showLoading();
	auth2.signOut();
}

// ran when google is logged in or out
function updateSigninStatus(isSignedIn) {
    $('#settings-warning').hide();

	if (isSignedIn) {
        displayUserInfo();

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

function displayUserInfo() {
    let profile = auth2.currentUser.get().getBasicProfile();
    
    $('#current-user-name').html(profile.getName());
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

function updateGuestMaxDisplay(guestMax) {
    $('#guest-ticket-max-count').html(guestMax);
}

function updateSheetLink(sheetLink) {
    $('#sheet-link-button').off();
    $('#sheet-link-button').on('click', () => {
        window.open(sheetLink);
    });
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

    // we don't want to show the warning if settings are invalid
    $('#settings-warning').hide();

    let sheetLink = $('#sheet-link').val();
    let sheetId = sheetLink.split('/')[5];

    let ticketTypes = [
        { name: 'Student' },
        { name: 'Guest' },
        { name: 'GA' }
    ];

    // fill in the details about all of the ticket types
    let ticketTypesToOffer = getSelectedTicketsToOffer();
    for (let ticketType of ticketTypes) {
        const selector = '#' + ticketType.name.toLowerCase() + '-price';
        ticketType.price = $(selector).val();

        ticketType.isOffered = ticketTypesToOffer.includes(ticketType.name);
        ticketType.sold = 0;
    }

    let guestMax = $('#guest-max').val();
    
    let info = { sheetLink, sheetId, ticketTypes, guestMax };

    // if the info is good, this will show ticket entry ui
    validateInfo(info);
});

function checkForSavedInfoFromCookies() {
    let savedInfo = Cookies.getJSON('info');
    if (!savedInfo) return false;

    for (let ticketType of savedInfo.ticketTypes) {
        // fill in ticket price inputs
        const ticketName = ticketType.name.toLowerCase();
        $('#' + ticketName + '-price').val(ticketType.price);

        // check the boxes of what tickets are offered
        checkSelectedTicketTypes(savedInfo.ticketTypes);
    }
    
    // fill in the other two sheet settings boxes
    $('#sheet-link').val(savedInfo.sheetLink);
    $('#guest-max').val(savedInfo.guestMax);

    return savedInfo;
}

function validateInfo(info) {
    return checkIfSheetValid(info.sheetId)
        .catch(err => {
            console.error(err);
            throw 'Invalid Google Sheet.' + err.result.error.message;
        })
        .then(() => {
            // these run if the sheet is, in fact, a real google sheet

            if (!isAtLeastOneTicketTypeSelected(info.ticketTypes)) {
                throw 'Please select at least one ticket type.';
            }

            if (!validatePrices(info)) {
                throw 'Invalid ticket prices.';
            }

            const isGuestSelected = info.ticketTypes.find(type => type.name === 'Guest').isOffered;
            const isGuestMaxValid = typeof info.guestMax && info.guestMax > 0;
            if (isGuestSelected && !isGuestMaxValid) {
                throw 'Invalid max guest ticket count.';
            }

            $('#settings-warning').show();

            // expires in 2 months
            Cookies.set('info', info, { expires: 60 });

            prepTicketEntry(info);
        })
        .catch(err => {
            console.error(err);

            // in case they accidentally messed up a setting, 
            // restore the last good settings from cookies
            checkForSavedInfoFromCookies();

            Swal('Try again', err, 'error');
            showScreen('#sheet-setup');
        });
}

function isAtLeastOneTicketTypeSelected(allTicketTypes) {
    for (let ticketType of allTicketTypes) {
        if (ticketType.isOffered) return true;
    }
    return false;
}

function validatePrices(info) {
    for (let ticketType of info.ticketTypes) {
        if (!ticketType.isOffered) continue;

        let price = parseFloat(ticketType.price);
        if (isNaN(price) || price < 0) return false;
    }

    return true;
}
 
TICKET_TYPE_RADIO_GROUP.on('click', e => {

    $('#ticket-type').children().removeClass('active');
    $(e.currentTarget).addClass('active');
    
    const selectedTicketType = e.currentTarget.getAttribute('value');
    
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

function callForLatestTicketCounts(info) {
    return getAllPurchases(info.sheetId)
        .then(allPurchases => updatePurchaseCount(info, allPurchases));
}

function prepTicketEntry(info) {
    callForLatestTicketCounts(info)
        .then(() => {            
            showScreen('#ticket-entry');
            resetTicketEntry();
        
            showTicketTypes(info.ticketTypes);
            updateGuestMaxDisplay(info.guestMax);
            updateSheetLink(info.sheetLink);
        
            // sometimes the form submit button tries to take focus,
            // so grab it again for good measure after .5 seconds
            setTimeout(() => $('#banner-id-input').focus(), 500);
        });

	$('#ticket-entry').off('submit');
	$('#ticket-entry').on('submit', () => {
		event.preventDefault();
        showLoading();
        
        // get new info from inputs
        info.bannerId = $('#banner-id-input').val();
        info.quantity = $('#quantity-input').val();
        info.ticketType = getSelectedTicketType();

        let ticketSalePromise;
        switch (info.ticketType) {
            case 'Student':
                ticketSalePromise = sellStudentTicket(info);
                break;
            case 'Guest':
                ticketSalePromise = sellGuestTickets(info);
                break;
            case 'GA':
                ticketSalePromise = sellGATickets(info);
                break;
            default:
                return Swal('Bad ticket type selected: ' + info.ticketType)
                    .then(() => prepTicketEntry(info));
        }

        //these will happen after every type of ticket sale
        return ticketSalePromise       
            // tell the user how much money to take from customer,
            // and log the ticket sale to the spreadsheet
            .then(() => confirmPayment(info))

            // show error before resetting
            .catch(err => errorNoTicket(err))

            // ran after payment is either confirmed or denied
            .then(() => prepTicketEntry(info));
        
	});
}

function sellStudentTicket(info) {
    
    // student can only buy themself one ticket
    info.quantity = 1;

    return verifyAndNormalizeBannerId(info)

        // make sure this student has not already purchased a ticket
        .then(() => ensureBannerIdIsUnused(info))
}

function sellGuestTickets(info) {
    return verifyAndNormalizeBannerId(info)
        .then(() => verifyQuantity(info))
        .then(() => ensureIdIsAllowedMoreTickets(info));
}

function sellGATickets(info) {
    return verifyQuantity(info);
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

    for (let ticketType of info.ticketTypes) {
        if (info.ticketType === ticketType.name) {
            return ticketType.price;
        }
    }

    throw 'Ticket type ' + info.ticketType + ' not found.'
}

function verifyAndNormalizeBannerId(info) {
    if (!/^\d+$/.test(info.bannerId)) {
        return Promise.reject('The banner ID must only contain numbers.');
    }

    if (info.bannerId.length !== 9) {
        return Promise.reject('The banner ID must be 9 digits long.');
    }

    info.bannerId = info.bannerId.replace(/^0+/, ''); // remove leading zeros
    return Promise.resolve();
}

function verifyQuantity(info) {
    info.quantity = parseInt(info.quantity);
    
    if (isNaN(info.quantity) || info.quantity <= 0) {
        return Promise.reject('Invalid quantity.');
    } else {
        return Promise.resolve();
    }
}

function ensureBannerIdIsUnused(info) {
    return getAllPurchases(info.sheetId)
        .then(allPurchases => {
            let numberOfStudentsTicketsBoughtWithThisBannerId
                = countBoughtTickets(allPurchases, 'Student', info.bannerId);

            if (numberOfStudentsTicketsBoughtWithThisBannerId > 0) {
                throw 'The banner ID has already been used.';
            } else {
                // it hasn't been used before
                return true;
            }
	    });
}

function ensureIdIsAllowedMoreTickets(info) {
    return getAllPurchases(info.sheetId)
        .then(allPurchases => {
            let numberOfGuestTicketsThisPersonHasAlreadyPurchased
                = countBoughtTickets(allPurchases, 'Guest', info.bannerId);

            let numberOfAllowedGuestTicketsRemainingForThisPerson 
                = parseInt(info.guestMax) - numberOfGuestTicketsThisPersonHasAlreadyPurchased;

            // if the number of tickets they are trying to buy is greater than
            // the number of tickets they are still allowed to buy, don't let em
            if (parseInt(info.quantity) > numberOfAllowedGuestTicketsRemainingForThisPerson) {
                throw 'This person has already bought '
                    + numberOfGuestTicketsThisPersonHasAlreadyPurchased
                    + ' guest tickets.<br>Each student is only allowed '
                    + info.guestMax
                    + ' guest tickets.';
            }

            return true;
            
        });
}

function logTicketSale(info) {
    const plural = info.quantity !== 1 ? 's' : '';

    return appendPurchaseToSheet(info)

        .then(() => {
            gtag("event", "ticket_sale", {
                event_label: info.ticketType
            });
            return Swal(
                `Give them ${info.quantity} ${info.ticketType} ticket${plural}!`,
                'The purchase has been logged in the spreadsheet. Yeet.',
                'success'
            );
        })

        // ran if the api throws an error
        .catch(res => {
            console.error(res);

            // grab the api's error message
            throw res.result.error.message;
        });
}

function errorNoTicket(errorMessage) {
    console.error(errorMessage);
    
	return Swal('Don\'t give them a ticket!', errorMessage, 'error');
}

function appendPurchaseToSheet(info) {
    let now = new Date();
    const weekday = now.toLocaleString('en-US', { weekday: 'short' });
    const timestamp = weekday + ' ' + now.toLocaleString();

    const ticketPrice = getTicketPrice(info);
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

// counts the number of tickets of the given type, by
// the given banner id
function countBoughtTickets(allPurchases, ticketType, bannerId) {
    let count = 0;

    for (let thisTicket of allPurchases) {
        const thisTicketType = thisTicket[0];
        const thisTicketBannerId = thisTicket[1];
        const thisTicketQuantity = thisTicket[2];

        const isSameTicketType = thisTicketType === ticketType;
        const isSameBannerId = thisTicketBannerId === bannerId;

        if (isSameTicketType && isSameBannerId) {
            count += parseInt(thisTicketQuantity);
        }
    }

    return count;
}

function updatePurchaseCount(info, allPurchases) {
    for (let availableTicketType of info.ticketTypes) {
        availableTicketType.sold = 0;
    }

    for (let thisTicket of allPurchases) {
        const thisTicketType = thisTicket[0];
        const thisTicketQuantity = thisTicket[2];

        for (let availableTicketType of info.ticketTypes) {
            if (thisTicketType === availableTicketType.name) {
                availableTicketType.sold += parseInt(thisTicketQuantity);
            }
        }
    }

    return allPurchases;
}

function getAllPurchases(spreadsheetId) {
    return readRangeFromSheet(spreadsheetId, 'B2:D')
        // grab the error message text from the api json
        .catch(({result}) => Promise.reject(result.error.message));
}

function readRangeFromSheet(spreadsheetId, rangeToRead) {
    return gapi.client.sheets.spreadsheets.values.get({
		spreadsheetId,
		range: SHEET_NAME + '!' + rangeToRead,
		resource: {
			majorDimension: "ROWS"
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
    return TICKET_TYPE_RADIO_GROUP.closest('.active').attr('value');
}

function showTicketTypes(allTicketTypes) {
    let first = false;
    for (let ticketType of allTicketTypes) {
        const thisButton = $(`#${ticketType.name.toLowerCase()}-radio`);
        if (ticketType.isOffered) {
            thisButton.show();

            // make sure that the first visible ticket type is selected by default
            if (!first) {
                // .change ensures the events attached to checking the box fire
                thisButton.click();
                first = true;
            }
        } else {
            thisButton.hide();
        }

        // update the price badge
        thisButton.find('.price').html('$' + ticketType.price);

        // update the sold badge
        thisButton.find('.sold').html(ticketType.sold + ' sold');
    }
}

function checkSelectedTicketTypes(allTicketTypes) {
    for (let ticketType of allTicketTypes) {
        const selector = `#${ticketType.name.toLowerCase()}-check`;
        if (ticketType.isOffered) {
            $(selector).prop("checked", true).change();
        } else {
            $(selector).prop("checked", false).change();
        }
    }
}
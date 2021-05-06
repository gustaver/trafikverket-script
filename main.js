const fetch = require('node-fetch');
const fs = require('fs');
const Pushover = require('node-pushover');
require('dotenv').config()

const push = new Pushover({
  token: process.env.PUSHOVER_TOKEN,
  user: process.env.PUSHOVER_USER
});

const locationToId = JSON.parse(fs.readFileSync("locations.json"));
const theoryLocations = [
  "Stockholm City",
  "Södertälje",
  "Sollentuna",
  "Järfälla",
  "Nyköping",
  "Norrköping",
  "Eskilstuna",
  "Uppsala"
];
const drivingLocations = [
  "Stockholm City", 
  "Farsta",
  "Sollentuna",
  "Tullinge",
  "Södertälje",
  "Järfälla",
  "Strängnäs",
  "Eskilstuna",
  "Nynäshamn",
  "Nyköping",
  "Norrköping",
  "Linköping",
  "Norrtälje 2",
  "Uppsala",
  "Enköping",
  "Västerås",
  "Örebro",
  "Katrineholm"
];

const LICENSE_ID = 5;
const SSN = process.env.SSN;

var [, , TYPE, START_DATE, END_DATE, SEARCH] = process.argv;
const THEORY = TYPE === "THEORY";
START_DATE = new Date(START_DATE);
END_DATE = new Date(END_DATE);

let locations;
if (SEARCH && SEARCH === "ALL") {
  locations = Object.keys(locationToId);
} else {
  locations = THEORY ? theoryLocations : drivingLocations;
  locations = locations.map(loc => locationToId[loc]);
}

function getOccassions(locationId) {
  const body = {
    "bookingSession": {
      "socialSecurityNumber": SSN,
      "licenceId": LICENSE_ID,
      "bookingModeId": 0, 
      "ignoreDebt": false,
      "ignoreBookingHindrance": false,
      "examinationTypeId": 0, 
      "excludeExaminationCategories": [], 
      "rescheduleTypeId": 0,
      "paymentIsActive": false,
      "paymentReference": null,
      "paymentUrl": null
    },
    "occasionBundleQuery": {
      "startDate": START_DATE.toISOString(),
      "locationId": locationId,
      "nearbyLocationIds": [],
      "languageId": 13,
      "tachographTypeId": 1,
      "occasionChoiceId": 1,
      "vehicleTypeId": 4,
      "examinationTypeId": THEORY ? 3 : 12
    }
  }
  return fetch("https://fp.trafikverket.se/boka/occasion-bundles", {
    "headers": {
      "accept": "application/json",
      "content-type": "application/json"
    },
    "body": JSON.stringify(body),
    "method": "POST"
  })
  .then(resp => resp.json())
  .then(data => {
    return data.data
      .flatMap(occ => occ.occasions.map((o) => {return {date: new Date(o.date), time: o.time, locationName: o.locationName}}));
  });
}

function pushNotify(occasion) {
  const title = THEORY ? "Kunskapsprov" : "Körprov";
  const description = `${occasion.locationName} ${occasion.date.toDateString()} ${occasion.time}`; 
  push.send(title, description);
}

Promise.all(locations.map(locId => getOccassions(locId)))
  .then(occasions => {
    const occassionsFiltered = occasions.flat().filter(occ => occ.date >= START_DATE && occ.date <= END_DATE);
    // occasionsFlat.sort((a, b) => a.date - b.date);
    occassionsFiltered.forEach(o => console.log(o));
  });
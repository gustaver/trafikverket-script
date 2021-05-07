const fetch = require('node-fetch');
const fs = require('fs');
require('dotenv').config()

const LOCATION_TO_ID = JSON.parse(fs.readFileSync("locations.json"));
const NOTIFIED_OCCASIONS = fs.existsSync("notifiedOccasions.json") ? JSON.parse(fs.readFileSync("notifiedOccasions.json")) : [];

function notified(occasion) {
  return NOTIFIED_OCCASIONS.filter(occ => occ.locationName === occasion.locationName && occ.time === occasion.time && occ.date === occasion.date.toISOString()).length !== 0;
}

function occasionToString(occasion) {
  return `${occasion.locationName} ${occasion.date.toDateString()} ${occasion.time}`;
}

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
  locations = Object.keys(LOCATION_TO_ID);
} else {
  locations = THEORY ? theoryLocations : drivingLocations;
  locations = locations.map(loc => LOCATION_TO_ID[loc]);
}

async function main() {
  async function getOccassions(locationId) {
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
    const res = await fetch("https://fp.trafikverket.se/boka/occasion-bundles", {
      headers: {
        "accept": "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify(body),
      method: "POST"
    });

    if (!res.ok) {
      console.error(`Could not fetch occasions for location id: ${locationId}`);
      return [];
    }

    const data = await res.json();
    return data.data
      .flatMap(occ => occ.occasions.map((o) => {return {date: new Date(o.date), time: o.time, locationName: o.locationName}}));
  }
  
  async function pushNotify(occasion) {
    const title = THEORY ? "Kunskapsprov" : "Körprov";
    const message = occasionToString(occasion);

    const params = new URLSearchParams();
    params.append("token", process.env.PUSHOVER_TOKEN);
    params.append("user", process.env.PUSHOVER_USER);
    params.append("title", title);
    params.append("message", message);

    const res = await fetch("https://api.pushover.net/1/messages.json", {
        body: params,
        method: "POST"
    });

    return [occasion, res.ok];
  }

  const occasions = await Promise.all(locations.map(locId => getOccassions(locId)));
  const occassionsFiltered = occasions.flat().filter(occ => occ.date >= START_DATE && occ.date <= END_DATE);
  occassionsFiltered.forEach(occ => console.log(`Found: ${occasionToString(occ)}`));
  
  const occassionsUnnotified = occassionsFiltered.filter(occ => !notified(occ));

  const occasionNotifications = await Promise.all(occassionsUnnotified.map(occ => pushNotify(occ)));

  const pushedOccasions = occasionNotifications.filter(([, ok]) => ok).map(([occ, ]) => occ);

  pushedOccasions.forEach(occ => console.log(`Notified: ${occasionToString(occ)}`));

  NOTIFIED_OCCASIONS.push(...pushedOccasions);

  fs.writeFileSync("notifiedOccasions.json", JSON.stringify(NOTIFIED_OCCASIONS));
}

main();
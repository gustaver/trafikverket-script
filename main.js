const fetch = require('node-fetch');
const fs = require('fs');

const [, , SSN] = process.argv;
const THEORY = process.argv[3] === "true";
const SEARCH_ALL = process.argv[4] === "true";
const LICENSE_ID = 5;

const locations = JSON.parse(fs.readFileSync("locations.json"));


const specificLocations = [
  "Stockholm City", 
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
const searchLocations = SEARCH_ALL ? Object.values(locations) : specificLocations.map(loc => locations[loc]);

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
      "startDate": new Date().toISOString(),
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

Promise.all(searchLocations.map(locId => getOccassions(locId)))
  .then(occasions => {
    occasionsFlat = occasions.flat();
    occasionsFlat.sort((a, b) => a.date - b.date);
    occasionsFlat.slice(0, 30).forEach(o => console.log(o));
  });
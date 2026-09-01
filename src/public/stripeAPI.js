import {fetch} from 'wix-fetch';
 
export async function createToken(card) {
//Go to stripe.com to create a test key and replace the one in the example
const apiKey = "pk_live_E837sk94gRcivFJgWMwdEKMC";
 
const response = await fetch("https://api.stripe.com/v1/tokens", {
method: 'post',
headers: {
"Content-Type": "application/x-www-form-urlencoded",
"Authorization": "Bearer " + apiKey
},
body: card
});
 
if (response.status >= 200 && response.status < 300) {
const json = await response.json()
return json.id;
}
const responseText = await response.text();
console.log(responseText);
return response.status;
}
 
export function encodeCard(card){
let encoded = "";
for (let [k, v] of Object.entries(card)) {
encoded = encoded.concat("card[", k, "]=", encodeURI(v), "&");
}
return encoded.substr(0, encoded.length - 1);
}
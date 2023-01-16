import "https://deno.land/x/dotenv@v3.2.0/load.ts";
import * as path from "https://deno.land/std@0.172.0/path/mod.ts";
import { Client } from "npm:@notionhq/client@2.2.3";
import { google } from "npm:googleapis@105";
import { authenticate } from "npm:@google-cloud/local-auth@2.1.0";

const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];
const TOKEN_PATH = path.join(Deno.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(Deno.cwd(), "credentials.json");

async function loadSavedCredentialsIfExist() {
  try {
    const content = await Deno.readTextFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

async function saveCredentials(client: any) {
  const content = await Deno.readTextFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await Deno.writeTextFile(TOKEN_PATH, payload);
}

async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

const databaseId = Deno.env.get("NOTION_DATABASE_ID");

async function listEvents(auth: any) {
  const calendar = google.calendar({ version: "v3", auth });
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: "startTime",
  });
  const events = res.data.items;
  if (!events || events.length === 0) {
    console.log("No upcoming events found.");
    return;
  }
  console.log("Upcoming 10 events:");
  events.map((event: any, i: number) => {
    const start = event.start.dateTime || event.start.date;
    console.log(`${start} - ${event.summary}`);
  });
}

authorize().then(listEvents).catch(console.error);

const notion = new Client({
  auth: Deno.env.get("NOTION_TOKEN"),
});

const search = await notion.search({
  filter: {
    value: "database",
    property: "object",
  },
});

console.log(search.results[0]);

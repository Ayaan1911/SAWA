import fs from 'node:fs/promises';
import { google } from 'googleapis';
import { config } from '../config';
import type { MeetingInsight } from '../types';

export async function getMeetingInsight(): Promise<MeetingInsight> {
  if (!config.google.credentialsPath) {
    return {
      status: 'missing-config',
      summary: 'Google Calendar intelligence is implemented but the credentials path is not configured.',
      upcoming: []
    };
  }

  try {
    const raw = await fs.readFile(config.google.credentialsPath, 'utf8');
    const credentials = JSON.parse(raw) as {
      client_email: string;
      private_key: string;
      calendar_id?: string;
    };

    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly']
    });
    const calendar = google.calendar({ version: 'v3', auth });
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    const response = await calendar.events.list({
      calendarId: credentials.calendar_id ?? 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 5
    });
    const upcoming = (response.data.items ?? []).map((item) => `${item.summary ?? 'Untitled'} @ ${item.start?.dateTime ?? item.start?.date ?? 'unknown'}`);

    return {
      status: 'available',
      summary: upcoming.length ? `Next meeting: ${upcoming[0]}` : 'No meetings in the next 24 hours.',
      upcoming
    };
  } catch (error) {
    return {
      status: 'missing-config',
      summary: `Google Calendar call failed: ${error instanceof Error ? error.message : 'unknown error'}.`,
      upcoming: []
    };
  }
}

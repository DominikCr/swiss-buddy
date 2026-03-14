import ICAL from 'ical.js';

export interface FlightEntry {
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureDate: string;
  layoverHours: number;
}

export function parseIcal(icalString: string): FlightEntry[] {
  try {
    const jcal = ICAL.parse(icalString);
    const comp = new ICAL.Component(jcal);
    const events = comp.getAllSubcomponents('vevent');
    const flights: FlightEntry[] = [];

    for (const event of events) {
      const summary = event.getFirstPropertyValue('summary') as string;
      const dtstart = event.getFirstPropertyValue('dtstart') as ICAL.Time;
      const dtend = event.getFirstPropertyValue('dtend') as ICAL.Time;

      if (!summary || !dtstart) continue;

      // Format: "LX40 ZRH 1315 LAX 1543 77W V [RP]"
      const match = summary.match(/^([A-Z]{2}\d+)\s+([A-Z]{3})\s+\d+\s+([A-Z]{3})/);
      if (!match) continue;

      const startDate = dtstart.toJSDate();
      const endDate = dtend ? dtend.toJSDate() : startDate;
      const layoverHours = Math.round((endDate.getTime() - startDate.getTime()) / 3600000);

      flights.push({
        flightNumber: match[1],
        departureAirport: match[2],
        arrivalAirport: match[3],
        departureDate: startDate.toISOString().split('T')[0],
        layoverHours: layoverHours > 0 ? layoverHours : 0,
      });
    }

    return flights;
  } catch (e) {
    console.error('iCal parse error:', e);
    return [];
  }
}
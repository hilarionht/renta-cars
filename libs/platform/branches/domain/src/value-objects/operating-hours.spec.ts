import { OperatingHours } from './operating-hours';

describe('OperatingHours', () => {
  it('acepta un horario valido', () => {
    const hours = OperatingHours.from([
      { day: 'monday', open: '09:00', close: '18:00' },
      { day: 'saturday', open: '10:00', close: '14:00' },
    ]);

    expect(hours.toSchedule()).toHaveLength(2);
  });

  it('rechaza dos entradas para el mismo dia', () => {
    expect(() =>
      OperatingHours.from([
        { day: 'monday', open: '09:00', close: '18:00' },
        { day: 'monday', open: '19:00', close: '20:00' },
      ]),
    ).toThrow(/mas de una entrada/);
  });

  it('rechaza un formato de hora invalido', () => {
    expect(() => OperatingHours.from([{ day: 'monday', open: '9am', close: '18:00' }])).toThrow(
      /horario invalido/,
    );
  });

  it('rechaza open >= close', () => {
    expect(() => OperatingHours.from([{ day: 'monday', open: '18:00', close: '09:00' }])).toThrow(
      /antes que "close"/,
    );
  });
});

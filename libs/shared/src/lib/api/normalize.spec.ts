import { RequestDto, parseAmount, toCatalogType, toInternalRequest } from './normalize';

const baseDto: RequestDto = {
  id: 37,
  title: 'Visita a cliente',
  type: 'travel',
  status: 'pending',
  requesterId: 2,
  requesterName: 'Bruno Díaz',
  createdAt: '2026-10-21T14:03:11.000Z',
  updatedAt: '2026-10-21T14:03:11.000Z',
  version: 1,
  details: { destination: 'Bogotá', startDate: '2026-12-15', endDate: '2026-12-18' },
  amount: '8400.00',
};

describe('parseAmount', () => {
  it.each([
    [8400, 8400],
    ['8400', 8400],
    ['8400.00', 8400],
    ['  1750.5 ', 1750.5],
    [0, 0],
  ])('normalizes %j to %j', (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });

  it.each([[undefined], [null], [''], ['abc'], ['12,5'], [Number.NaN], [Number.POSITIVE_INFINITY], [{}]])(
    'returns null for %j',
    (raw) => {
      expect(parseAmount(raw)).toBeNull();
    },
  );
});

describe('toInternalRequest', () => {
  it('maps a travel request and normalizes a string amount', () => {
    const request = toInternalRequest(baseDto);
    expect(request.type).toBe('travel');
    expect(request.amount).toBe(8400);
    expect(request.details).toEqual({ destination: 'Bogotá', startDate: '2026-12-15', endDate: '2026-12-18' });
    expect(request.decisionComment).toBeNull();
  });

  it('forces amount to null for access requests even if the API sends one', () => {
    const request = toInternalRequest({
      ...baseDto,
      type: 'access',
      amount: '99',
      details: { system: 'Power BI', justification: 'Necesito los reportes de ventas' },
    });
    expect(request.amount).toBeNull();
    expect(request.details).toEqual({ system: 'Power BI', justification: 'Necesito los reportes de ventas' });
  });

  it('fills missing detail fields with empty strings instead of undefined', () => {
    const request = toInternalRequest({ ...baseDto, type: 'equipment', details: undefined, amount: 100 });
    expect(request.details).toEqual({ model: '' });
  });

  it('rejects unknown types', () => {
    expect(() => toInternalRequest({ ...baseDto, type: 'vacation' })).toThrow();
  });
});

describe('toCatalogType', () => {
  it('normalizes max amount from number or string', () => {
    expect(toCatalogType({ id: 'equipment', name: 'Equipo', description: '', amount: 3000 }).maxAmount).toBe(3000);
    expect(toCatalogType({ id: 'travel', name: 'Viaje', description: '', amount: '15000.00' }).maxAmount).toBe(15000);
  });

  it('treats a zero max amount as "no amount" for the type', () => {
    expect(toCatalogType({ id: 'access', name: 'Acceso', description: '', amount: '0' }).maxAmount).toBeNull();
  });
});

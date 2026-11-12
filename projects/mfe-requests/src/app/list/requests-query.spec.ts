import { convertToParamMap } from '@angular/router';
import { DEFAULT_REQUEST_FILTERS } from '@portal/shared';
import { filtersFromParams, filtersToParams } from './requests-query';

describe('requests query params', () => {
  it('reads valid filters from the URL', () => {
    const filters = filtersFromParams(
      convertToParamMap({ page: '3', limit: '20', q: ' laptop ', status: 'approved', type: 'travel' }),
    );
    expect(filters).toEqual({ page: 3, limit: 20, q: 'laptop', status: 'approved', type: 'travel' });
  });

  it('falls back to defaults for tampered values', () => {
    const filters = filtersFromParams(convertToParamMap({ page: '-1', limit: '999', status: 'deleted', type: 'x' }));
    expect(filters).toEqual(DEFAULT_REQUEST_FILTERS);
  });

  it('omits defaults when writing the URL, so a refresh round-trips', () => {
    const params = filtersToParams({ ...DEFAULT_REQUEST_FILTERS, status: 'pending' });
    expect(params).toEqual({ page: null, limit: null, q: null, status: 'pending', type: null });

    const roundTrip = filtersFromParams(convertToParamMap({ status: 'pending' }));
    expect(roundTrip).toEqual({ ...DEFAULT_REQUEST_FILTERS, status: 'pending' });
  });
});

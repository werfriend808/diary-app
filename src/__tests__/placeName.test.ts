/*
 * Example reverse-geocoding results and the place name each should become. The inputs are shaped like
 * what iOS and Android return; real results vary by OS version and exact spot, which is why the user
 * can always edit the name.
 */
import { type GeocodedAddress, MAX_PLACE_LENGTH, placeNameFrom } from '../placeName';

const EXAMPLES: { label: string; input: GeocodedAddress | null; expected: string }[] = [
  {
    label: 'Seoul, iOS style (region and city repeat)',
    input: { region: '서울특별시', city: '서울특별시', subregion: null, district: '성수동', name: '성수이로 78' },
    expected: '서울특별시 성수동',
  },
  {
    label: 'Seoul, Android style (구 in subregion)',
    input: {
      region: '서울특별시',
      city: null,
      subregion: '성동구',
      district: '성수동2가',
      name: '78',
      formattedAddress: '대한민국 서울특별시 성동구 성수동2가 78',
    },
    expected: '서울특별시 성동구 성수동2가',
  },
  {
    label: 'Seoul, phone set to English',
    input: { region: 'Seoul', city: 'Seoul', subregion: 'Seongdong-gu', district: 'Seongsu-dong' },
    expected: 'Seoul Seongdong-gu Seongsu-dong',
  },
  {
    label: 'Abroad, four different levels (county dropped)',
    input: { region: 'California', city: 'San Francisco', subregion: 'San Francisco County', district: 'Mission District' },
    expected: 'California San Francisco Mission District',
  },
  {
    label: 'Abroad, Japanese',
    input: { region: '東京都', city: '渋谷区', subregion: null, district: '神南' },
    expected: '東京都 渋谷区 神南',
  },
  {
    label: 'Abroad, England (district missing)',
    input: { region: 'England', city: 'London', subregion: 'Greater London', district: null },
    expected: 'England London Greater London',
  },
  {
    label: 'Only formattedAddress (Android)',
    input: { formattedAddress: '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA', name: '1600' },
    expected: '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
  },
  { label: 'Only name', input: { name: 'Jeju International Airport' }, expected: 'Jeju International Airport' },
  { label: 'Whitespace only', input: { region: '  ', city: '', district: ' ' }, expected: '' },
  { label: 'Empty result', input: {}, expected: '' },
  { label: 'No result at all', input: null, expected: '' },
];

describe('placeNameFrom', () => {
  it.each(EXAMPLES)('$label', ({ input, expected }) => {
    expect(placeNameFrom(input)).toBe(expected);
  });

  it(`never returns more than ${MAX_PLACE_LENGTH} characters`, () => {
    expect(placeNameFrom({ formattedAddress: 'x'.repeat(200) })).toHaveLength(MAX_PLACE_LENGTH);
  });
});

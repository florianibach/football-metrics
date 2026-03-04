import { getFileValidationMessage } from './fileValidation';

describe('getFileValidationMessage', () => {
  const options = {
    invalidExtensionMessage: 'invalid extension',
    invalidSizeMessage: 'too large',
    maxFileSizeInBytes: 1024
  };

  it('returns null when no file is selected', () => {
    expect(getFileValidationMessage(null, options)).toBeNull();
  });

  it('accepts tcx files regardless of extension casing', () => {
    const file = new File(['tcx-content'], 'SESSION.TCX', { type: 'application/xml' });
    expect(getFileValidationMessage(file, options)).toBeNull();
  });

  it('rejects non-tcx files', () => {
    const file = new File(['csv-content'], 'session.csv', { type: 'text/csv' });
    expect(getFileValidationMessage(file, options)).toBe(options.invalidExtensionMessage);
  });

  it('rejects files above the configured max size', () => {
    const content = 'a'.repeat(1025);
    const file = new File([content], 'session.tcx', { type: 'application/xml' });
    expect(getFileValidationMessage(file, options)).toBe(options.invalidSizeMessage);
  });

  it('accepts files exactly at max size boundary', () => {
    const content = 'a'.repeat(1024);
    const file = new File([content], 'session.tcx', { type: 'application/xml' });
    expect(getFileValidationMessage(file, options)).toBeNull();
  });
});

const JwtService = jest.fn().mockImplementation(() => ({
  sign: jest.fn().mockReturnValue('jwt-token'),
  verify: jest.fn(),
}));

module.exports = { JwtService };

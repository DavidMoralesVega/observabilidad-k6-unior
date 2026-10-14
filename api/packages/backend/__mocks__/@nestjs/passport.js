class MockAuthGuard {
  canActivate = jest.fn().mockReturnValue(true);
}

const PassportModule = { register: jest.fn().mockReturnValue({}) };
const AuthGuard = jest.fn().mockImplementation(() => MockAuthGuard);
const PassportStrategy = jest.fn().mockImplementation((Strategy) => Strategy);

module.exports = { PassportModule, AuthGuard, PassportStrategy };

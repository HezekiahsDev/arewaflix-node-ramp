import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import db from "../../models/db.js";
import config from "../../config/config.js";

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: config.jwt.secret,
};

const passportJwt = new JwtStrategy(opts, async (jwt_payload, done) => {
  try {
    const [user] = await db.query("SELECT * FROM users WHERE id = ?", [
      jwt_payload.id,
    ]);
    if (user.length > 0) {
      return done(null, user[0]);
    }
    return done(null, false);
  } catch (error) {
    return done(error, false);
  }
});

export default passportJwt;

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

passport.serializeUser((user: any, done) => {
  done(null, user.firebaseUid);
});

passport.deserializeUser((uid: string, done) => {
  done(null, { firebaseUid: uid });
});

const callbackURL = 'https://solar-ops.replit.app/api/auth/google/callback';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL,
      passReqToCallback: true,
    },
    async (req: any, accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        const tenantId = req.query.state;
        const userId = req.session?.firebaseUid;

        if (!tenantId || !userId) {
          return done(new Error('Missing tenant or user context'), null);
        }

        const googleEmail = profile.emails?.[0]?.value ?? '';
        const scopes = [
          'profile',
          'email',
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.compose',
        ];

        const { error } = await supabase
          .from('google_connections')
          .upsert(
            {
              tenant_id: tenantId,
              user_id: userId,
              google_email: googleEmail,
              access_token: accessToken,
              refresh_token: refreshToken || null,
              scopes,
              connected_at: new Date().toISOString(),
              last_sync: new Date().toISOString(),
            },
            { onConflict: 'tenant_id,user_id' }
          );

        if (error) {
          console.error('[Google OAuth] Supabase upsert error:', error);
          return done(error, null);
        }

        return done(null, { firebaseUid: userId });
      } catch (err) {
        console.error('[Google OAuth] Strategy error:', err);
        return done(err, null);
      }
    }
  )
);

export default passport;

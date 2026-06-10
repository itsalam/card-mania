import { ScrollView, View, StyleSheet } from 'react-native'
import { Text } from '@/components/ui/text/base-text'
import { Colors } from 'react-native-ui-lib'

const EFFECTIVE_DATE = 'May 1, 2025'
const CONTACT_EMAIL = 'support@cardmania.info'

export default function TermsOfServicePage() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <Text style={styles.h1}>Card Mania — Terms of Service</Text>
        <Text style={styles.meta}>Effective date: {EFFECTIVE_DATE}</Text>
        <Text style={styles.body}>
          {
            'Welcome to Card Mania. These Terms of Service ("Terms") govern your use of the Card Mania platform, which allows collectors to message each other and trade sports cards. By creating an account or using Card Mania, you agree to these Terms.'
          }
        </Text>

        <Text style={styles.h2}>1. Eligibility and Accounts</Text>
        <Text style={styles.body}>
          You must be at least 18 years old (or the age of majority in your jurisdiction) to use
          Card Mania. You are responsible for the accuracy of the information you provide, for
          maintaining the security of your account, and for all activity that occurs under it. One
          account per person.
        </Text>

        <Text style={styles.h2}>2. SMS / Text Messaging Terms</Text>
        <Text style={styles.body}>
          By providing your mobile phone number when creating or signing in to your Card Mania
          account, you agree to receive text messages from Card Mania.
        </Text>
        <View style={styles.bullets}>
          <Bullet
            label="Program description:"
            body="Card Mania sends account-related text messages, such as one-time verification codes used to confirm your identity and secure your account."
          />
          <Bullet
            label="Message frequency:"
            body="Message frequency varies based on your account activity (typically one message per sign-in or verification event)."
          />
          <Bullet
            label="Cost:"
            body="Message and data rates may apply. Check with your mobile carrier for details about your plan."
          />
          <Bullet
            label="Opt-out:"
            body="Reply STOP at any time to cancel and stop receiving text messages from Card Mania. After you opt out, you will receive one final message confirming your opt-out. Opting out may limit your ability to verify your account and sign in."
          />
          <Bullet
            label="Help:"
            body={`Reply HELP for assistance, or contact us at ${CONTACT_EMAIL}.`}
          />
          <Bullet
            label="Carrier disclaimer:"
            body="Mobile carriers are not liable for delayed or undelivered messages."
          />
          <Bullet
            label="Privacy:"
            body="Information about how we handle your phone number and other personal information is described in our Privacy Policy (/policy). No mobile information will be shared with third parties or affiliates for marketing or promotional purposes."
          />
        </View>

        <Text style={styles.h2}>3. Trading and Messaging</Text>
        <Text style={styles.body}>
          Card Mania facilitates communication and trades between users. You acknowledge that:
        </Text>
        <View style={styles.bullets}>
          <BulletPlain>
            Trades are agreements between users. Card Mania is not a party to any trade and does not
            take possession of, authenticate, grade, or guarantee any card.
          </BulletPlain>
          <BulletPlain>
            You are responsible for accurately describing cards you offer, honoring trades you agree
            to, and shipping items promptly and securely.
          </BulletPlain>
          <BulletPlain>
            {
              "Mailing addresses are shared between users only to complete an agreed trade. You may use another user's address solely for that purpose."
            }
          </BulletPlain>
          <BulletPlain>
            You will not use the messaging features for harassment, spam, scams, or any unlawful
            purpose.
          </BulletPlain>
        </View>

        <Text style={styles.h2}>4. Prohibited Conduct</Text>
        <Text style={styles.body}>
          {
            "You agree not to: misrepresent cards or their condition; list counterfeit or stolen items; attempt to defraud other users; harvest or misuse other users' personal information; interfere with the operation or security of the platform; or use Card Mania for any purpose that violates applicable law."
          }
        </Text>

        <Text style={styles.h2}>5. Content</Text>
        <Text style={styles.body}>
          You retain ownership of the content you post (such as card photos and descriptions) and
          grant Card Mania a limited license to display it as needed to operate the service. You are
          responsible for your content and must have the right to share it.
        </Text>

        <Text style={styles.h2}>6. Termination</Text>
        <Text style={styles.body}>
          You may delete your account at any time. We may suspend or terminate accounts that violate
          these Terms, harm other users, or compromise the platform. Sections that by their nature
          should survive termination (such as disclaimers and limitations of liability) will
          survive.
        </Text>

        <Text style={styles.h2}>7. Disclaimers</Text>
        <Text style={styles.body}>
          {
            'Card Mania is provided "as is" and "as available," without warranties of any kind, express or implied. We do not guarantee the value, authenticity, or condition of any card traded on the platform, the conduct of other users, or uninterrupted availability of the service.'
          }
        </Text>

        <Text style={styles.h2}>8. Limitation of Liability</Text>
        <Text style={styles.body}>
          To the maximum extent permitted by law, Card Mania and its operators will not be liable
          for indirect, incidental, special, consequential, or punitive damages, or for losses
          arising from trades between users, including lost, damaged, misdescribed, or undelivered
          cards. Our total liability for any claim relating to the service will not exceed the
          amount you paid us (if any) in the twelve months preceding the claim.
        </Text>

        <Text style={styles.h2}>9. Changes to These Terms</Text>
        <Text style={styles.body}>
          We may update these Terms from time to time. We will post the updated version with a
          revised effective date, and material changes will be communicated through the app or by
          email. Continued use of Card Mania after changes take effect constitutes acceptance of the
          updated Terms.
        </Text>

        <Text style={styles.h2}>10. Governing Law</Text>
        <Text style={styles.body}>
          These Terms are governed by the laws of the Province of British Columbia and the federal
          laws of Canada applicable therein, without regard to conflict-of-law principles.
        </Text>

        <Text style={styles.h2}>11. Contact</Text>
        <Text style={styles.body}>Questions about these Terms can be sent to:</Text>
        <View style={[styles.bullets, { marginTop: 8 }]}>
          <Text style={[styles.body, styles.bold]}>Card Mania</Text>
          <Text style={styles.body}>Email: {CONTACT_EMAIL}</Text>
        </View>
      </View>
    </ScrollView>
  )
}

function Bullet({ label, body }: { label: string; body: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.body}>
        <Text style={styles.bold}>{label}</Text> {body}
      </Text>
    </View>
  )
}

function BulletPlain({ children }: { children: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#0C0C0C',
  },
  container: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    gap: 12,
  },
  h1: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.$textDefault ?? '#fff',
    marginBottom: 4,
  },
  h2: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.$textDefault ?? '#fff',
    marginTop: 20,
    marginBottom: 2,
  },
  meta: {
    fontSize: 13,
    color: Colors.$textNeutral ?? 'rgba(255,255,255,0.5)',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.$textNeutralHeavy ?? 'rgba(255,255,255,0.75)',
  },
  bold: {
    fontWeight: '600',
    color: Colors.$textDefault ?? '#fff',
  },
  bullets: {
    gap: 6,
    paddingLeft: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  bulletDot: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.$textNeutral ?? 'rgba(255,255,255,0.5)',
  },
})

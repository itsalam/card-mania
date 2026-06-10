import { ScrollView, View, StyleSheet } from 'react-native'
import { Text } from '@/components/ui/text/base-text'
import { Colors } from 'react-native-ui-lib'

const EFFECTIVE_DATE = 'May 1, 2025'
const CONTACT_EMAIL = 'support@cardmania.info'

export default function PrivacyPolicyPage() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <Text style={styles.h1}>Card Mania — Privacy Policy</Text>
        <Text style={styles.meta}>Effective date: {EFFECTIVE_DATE}</Text>
        <Text style={styles.body}>
          {
            'Card Mania ("we," "us," or "our") provides a platform for collectors to message each other and trade sports cards. This Privacy Policy explains what information we collect, how we use it, and the choices you have.'
          }
        </Text>

        <Text style={styles.h2}>1. Information We Collect</Text>
        <Text style={styles.body}>
          We collect only the information needed to operate Card Mania:
        </Text>
        <View style={styles.bullets}>
          <Bullet
            label="Email address"
            body="used to create and secure your account and to send account-related notices (such as email confirmations and trade notifications)."
          />
          <Bullet
            label="Phone number"
            body="used to verify your account and deliver one-time verification codes by SMS."
          />
          <Bullet
            label="Mailing address"
            body="used solely to facilitate the shipping and exchange of sports cards between users who agree to a trade."
          />
          <Bullet
            label="Messages and trade activity"
            body="the messages you send to other users and the details of trades you propose or complete, used to operate the messaging and trading features."
          />
        </View>
        <Text style={styles.body}>
          We do not collect more information than is necessary to provide these services.
        </Text>

        <Text style={styles.h2}>2. How We Use Your Information</Text>
        <Text style={styles.body}>We use your information to:</Text>
        <View style={styles.bullets}>
          <BulletPlain>Create, verify, and secure your account;</BulletPlain>
          <BulletPlain>Send one-time verification codes and account notifications;</BulletPlain>
          <BulletPlain>Enable messaging between users;</BulletPlain>
          <BulletPlain>Facilitate the trading and shipping of sports cards;</BulletPlain>
          <BulletPlain>Maintain the safety and integrity of the platform.</BulletPlain>
        </View>
        <Text style={styles.body}>
          We do <Text style={styles.bold}>not</Text> use your information for third-party
          advertising, and we do not sell your personal information.
        </Text>

        <Text style={styles.h2}>3. SMS / Text Messaging</Text>
        <Text style={styles.body}>
          By providing your phone number during sign-up, you consent to receive text messages from
          Card Mania for account verification and security purposes (for example, one-time
          passcodes).
        </Text>
        <View style={styles.bullets}>
          <BulletPlain>
            Message frequency varies based on your account activity (typically one message per
            sign-in or verification event).
          </BulletPlain>
          <BulletPlain>Message and data rates may apply.</BulletPlain>
          <BulletPlain>
            Reply STOP at any time to opt out of text messages. Reply HELP for help.
          </BulletPlain>
          <BulletPlain>
            No mobile information will be shared with third parties or affiliates for marketing or
            promotional purposes. Phone numbers and SMS opt-in consent are not sold, rented, or
            shared with any third party.
          </BulletPlain>
        </View>
        <Text style={styles.body}>
          Opting out of SMS may limit your ability to verify your account.
        </Text>

        <Text style={styles.h2}>4. How We Share Information</Text>
        <Text style={styles.body}>We share information only in these limited circumstances:</Text>
        <View style={styles.bullets}>
          <Bullet
            label="With other users, at your direction."
            body="When you agree to a trade, the information needed to complete it (such as your mailing address) is shared with the other party to that trade."
          />
          <Bullet
            label="With service providers."
            body="We use trusted vendors to operate the platform (for example, SMS delivery and database hosting). These providers process your information only on our behalf and only to provide their services to us."
          />
          <Bullet
            label="For legal reasons."
            body="We may disclose information if required by law or to protect the rights, safety, and security of our users or the platform."
          />
        </View>
        <Text style={styles.body}>
          We do not sell personal information, and we do not share it with third parties for their
          own marketing purposes.
        </Text>

        <Text style={styles.h2}>5. Data Retention</Text>
        <Text style={styles.body}>
          We keep your information for as long as your account is active or as needed to provide the
          service. You may request deletion of your account and associated personal information at
          any time by contacting us at the address below.
        </Text>

        <Text style={styles.h2}>6. Security</Text>
        <Text style={styles.body}>
          We take reasonable technical and organizational measures to protect your information,
          including encrypted connections and access controls. No method of transmission or storage
          is completely secure, but we work to protect your data against unauthorized access, loss,
          or misuse.
        </Text>

        <Text style={styles.h2}>7. Your Choices and Rights</Text>
        <Text style={styles.body}>You may:</Text>
        <View style={styles.bullets}>
          <BulletPlain>
            Access, correct, or update your account information at any time;
          </BulletPlain>
          <BulletPlain>Opt out of SMS messages by replying STOP;</BulletPlain>
          <BulletPlain>
            Request a copy of your personal information or ask that it be deleted by contacting us.
          </BulletPlain>
        </View>
        <Text style={styles.body}>
          We will respond to requests in accordance with applicable privacy laws.
        </Text>

        <Text style={styles.h2}>{"8. Children's Privacy"}</Text>
        <Text style={styles.body}>
          Card Mania is not directed to children under 13, and we do not knowingly collect personal
          information from children under 13. If you believe a child has provided us with personal
          information, please contact us so we can remove it.
        </Text>

        <Text style={styles.h2}>9. Changes to This Policy</Text>
        <Text style={styles.body}>
          We may update this Privacy Policy from time to time. We will post the updated version on
          this page with a revised effective date. Material changes will be communicated through the
          app or by email.
        </Text>

        <Text style={styles.h2}>10. Contact Us</Text>
        <Text style={styles.body}>
          Questions or requests regarding this Privacy Policy can be sent to:
        </Text>
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
        <Text style={styles.bold}>{label}</Text>
        {' — '}
        {body}
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

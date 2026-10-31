import { LANGUAGE } from '../../i18n';

/**
 * Legal texts (SET-02). Drafts: the operator's details are left as 【…】 until the
 * business entity is decided (Q-10/Q-12) and must be reviewed before release.
 */
const JAPANESE = {
  terms: {
    title: '利用規約',
    body: `この利用規約（以下「本規約」）は、【運営者名】（以下「運営者」）が提供するアプリ「fanT」（以下「本アプリ」）の利用条件を定めるものです。

第1条（適用）
本規約は、本アプリを利用するすべての方（以下「ユーザー」）に適用されます。

第2条（アカウント）
本アプリは会員登録を必要としません。購入の管理には、App Store または Google Play のアカウントを使用します。

第3条（有料サービス）
1. プレミアム（年額）は自動更新の定期購入です。期間終了の24時間前までに解約しない限り、自動で更新されます。解約はストアのサブスクリプション設定から行えます。
2. プレミアム（買い切り）は一度の購入で利用できます。将来の個別販売パックは対象外となる場合があります。
3. AIクレジットは、AI変身・けしゴム・高画質化の1回ごとに消費されます。生成に失敗した場合、消費したクレジットは返却されます。年額プランの毎月のクレジットは翌月に繰り越されません。
4. 返金は各ストアの手続きに従います。

第4条（AI変身）
1. AI変身では、ユーザーが選んだ写真をサーバーに送信し、画像生成AIで加工します。
2. 自分が写っている写真、または写っている人の許可を得た写真だけを使用してください。
3. 送信した写真と生成した画像は、処理の終了後すぐに削除されます（最長24時間）。AIの学習には使用しません。
4. 不適切な内容は生成できません。不適切な結果はアプリから報告できます。

第5条（禁止事項）
ユーザーは、法令または公序良俗に反する行為、他人の権利を侵害する行為、本アプリの運営を妨げる行為をしてはなりません。

第6条（コンテンツの権利）
ユーザーが撮影・作成した写真の権利はユーザーに帰属します。本アプリのフィルム・キャラクター・スタンプ等の権利は運営者または正当な権利者に帰属します。

第7条（免責）
運営者は、本アプリの利用により生じた損害について、運営者の故意または重大な過失による場合を除き、責任を負いません。

第8条（規約の変更）
運営者は、必要に応じて本規約を変更できます。重要な変更はアプリ内でお知らせします。

第9条（準拠法・管轄）
本規約は日本法に準拠し、紛争は【管轄裁判所】を第一審の専属的合意管轄裁判所とします。

【制定日】`,
  },
  privacy: {
    title: 'プライバシーポリシー',
    body: `【運営者名】（以下「運営者」）は、アプリ「fanT」における個人情報の取り扱いを次のとおり定めます。

1. 端末の中だけで処理する情報
撮影した写真、加工、顔の位置や目の開き具合などの検出結果は、端末の中だけで処理します。顔の検出結果は保存も送信もしません。保存する写真から位置情報（GPS）は削除します。動画の撮影ではマイクで音声を録音しますが、動画は端末の中だけで保存・加工します。

2. サーバーに送る情報
・AI変身・けしゴム・高画質化：ユーザーが選んだ写真（長辺1024ピクセルに縮小したもの。けしゴムではなぞった範囲も）。処理が終わるとすぐに削除し（最長24時間）、AIの学習には使用しません。画像生成サービスの提供元にも、学習に使用しない条件で処理を委託します。
・利用状況：アプリの起動、モードやフィルムの利用、撮影・保存・共有、購入、エラーの発生などの匿名の記録。端末ごとのランダムなIDで扱い、広告IDは使用しません。
・購入情報：購入の確認と管理のため、RevenueCat を通じて購入の状態を扱います。

3. 利用目的
サービスの提供・改善、不正利用の防止、お問い合わせへの対応のために利用します。

4. 第三者提供
法令に基づく場合を除き、本人の同意なく第三者に提供しません。

5. 安全管理
通信はすべて暗号化（HTTPS）し、サーバーのデータへのアクセスを制限します。

6. お問い合わせ
【連絡先】

【制定日】`,
  },
  commerce: {
    title: '特定商取引法に基づく表記',
    body: `販売事業者：【事業者名】
運営統括責任者：【氏名】
所在地：【所在地】（請求があった場合、遅滞なく開示します）
連絡先：【メールアドレス】
販売価格：各商品の購入画面に表示する価格（税込）
商品代金以外の必要料金：インターネット接続にかかる通信料
支払方法：App Store または Google Play の決済
提供時期：購入手続きの完了後すぐ
返品・キャンセル：デジタル商品の性質上、購入後の返品はできません。返金は各ストアの規定に従います。
動作環境：iOS 17 以上 / Android 10 以上`,
  },
  licenses: {
    title: 'ライセンス',
    body: `本アプリは、次のオープンソースソフトウェアなどを利用しています。

React Native / React — MIT License
Expo — MIT License
React Native Skia (Shopify) — MIT License
Skia — BSD 3-Clause License
VisionCamera (Marc Rousavy) — MIT License
react-native-vision-camera-face-detector — MIT License
Google ML Kit Face Detection — Google APIs Terms of Service
React Native Reanimated / Gesture Handler / Worklets (Software Mansion) — MIT License
Nitro Modules — MIT License
RevenueCat SDK — MIT License
Zustand — MIT License
Zod — MIT License
Ionicons — MIT License
M PLUS Rounded 1c (M+ FONTS Project) — SIL Open Font License 1.1
Hachi Maru Pop (Nonty) — SIL Open Font License 1.1
Yusei Magic (Tanukifont) — SIL Open Font License 1.1
DotGothic16 (Fontworks) — SIL Open Font License 1.1
Dela Gothic One (artakana) — SIL Open Font License 1.1

各ライセンスの全文は、それぞれの配布元で確認できます。`,
  },
} as const;

export type LegalDocument = keyof typeof JAPANESE;

const NOTE = 'This is a translation for convenience. The Japanese version prevails.';

/** English versions (SET-05); the Japanese texts are the binding ones. */
const ENGLISH: Record<LegalDocument, { readonly title: string; readonly body: string }> = {
  terms: {
    title: 'Terms of Use',
    body: `${NOTE}

These Terms of Use ("Terms") set out the conditions for using the app "fanT" (the "App") provided by [Operator] (the "Operator").

1. Scope
These Terms apply to everyone who uses the App ("Users").

2. Accounts
The App needs no sign-up. Purchases are managed with your App Store or Google Play account.

3. Paid services
(1) Premium (annual) is an auto-renewing subscription. It renews automatically unless cancelled at least 24 hours before the period ends. Cancel in your store's subscription settings.
(2) Premium (lifetime) is a one-time purchase. Packs sold separately in the future may not be included.
(3) AI credits are used for each AI transformation, erase or upscale. If it fails, the credits are returned. Monthly credits of the annual plan do not carry over.
(4) Refunds follow each store's procedures.

4. AI features
(1) AI features send the photo you pick to our server and edit it with image-generation AI.
(2) Only use photos of yourself, or of people who agreed.
(3) Sent photos and results are deleted soon after processing (within 24 hours) and are not used to train AI.
(4) Inappropriate content cannot be generated. You can report inappropriate results in the App.

5. Prohibited conduct
Users must not break the law or public order, infringe the rights of others or interfere with the App.

6. Rights
Photos you take or make belong to you. Films, characters, stamps and other content in the App belong to the Operator or their rightful owners.

7. Disclaimer
The Operator is not liable for damage arising from use of the App, except in cases of the Operator's intent or gross negligence.

8. Changes
The Operator may change these Terms when needed. Important changes are announced in the App.

9. Governing law and jurisdiction
These Terms are governed by the laws of Japan. [Court] has exclusive jurisdiction in the first instance.

[Effective date]`,
  },
  privacy: {
    title: 'Privacy Policy',
    body: `${NOTE}

[Operator] (the "Operator") handles personal information in the app "fanT" as follows.

1. Information processed only on your device
Photos, edits and face detection results (such as where faces are and whether eyes are open) are processed only on your device. Face detection results are never stored or sent. Location (GPS) is removed from saved photos. Videos record sound with the microphone, and are stored and edited only on your device.

2. Information sent to our server
- AI features: the photo you pick, reduced to 1024 pixels on its long edge (and, for erasing, the area you painted). It is deleted soon after processing (within 24 hours) and not used to train AI. The image-generation provider processes it on the condition that it is not used for training either.
- Usage: anonymous records such as app launches, modes and films used, photos taken, saved and shared, purchases and errors, under a random ID per device. No advertising ID is used.
- Purchases: the purchase status is handled through RevenueCat to confirm and manage purchases.

3. Purposes
To provide and improve the service, prevent misuse and answer enquiries.

4. Sharing with third parties
We do not share personal information with third parties without consent, except as required by law.

5. Security
All communication is encrypted (HTTPS) and access to server data is restricted.

6. Contact
[Contact]

[Effective date]`,
  },
  commerce: {
    title: 'Legal notice (Act on Specified Commercial Transactions)',
    body: `${NOTE}

Seller: [Business name]
Responsible person: [Name]
Address: [Address] (disclosed without delay on request)
Contact: [Email]
Prices: as shown on each purchase screen (tax included)
Other costs: internet connection charges
Payment: App Store or Google Play billing
Delivery: immediately after purchase
Returns and cancellation: digital goods cannot be returned after purchase. Refunds follow each store's rules.
Requirements: iOS 17 or later / Android 10 or later`,
  },
  licenses: {
    title: 'Licenses',
    body: JAPANESE.licenses.body
      .replace(
        '本アプリは、次のオープンソースソフトウェアなどを利用しています。',
        'This app uses the following open-source software and fonts.',
      )
      .replace(
        '各ライセンスの全文は、それぞれの配布元で確認できます。',
        'The full text of each license is available from its source.',
      ),
  },
};

/** Legal texts shown in the app (SET-02), in the app's language. */
export const LEGAL_DOCUMENTS: Record<
  LegalDocument,
  { readonly title: string; readonly body: string }
> = LANGUAGE === 'ja' ? JAPANESE : ENGLISH;

export function isLegalDocument(value: string | undefined): value is LegalDocument {
  return value !== undefined && Object.hasOwn(LEGAL_DOCUMENTS, value);
}

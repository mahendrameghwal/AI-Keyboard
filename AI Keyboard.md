# **AI Keyboard**

## **Complete Software Requirements Specification (SRS), Technical Architecture & Development Plan**

Document ID: AIK-SRS-001 · Version 1.0 · Date: October 16, 2026 · Status: Development Planning

# **Table of Contents**

1. Project Overview  
2. Vision and Objectives  
3. Scope of the Project  
4. Target Users  
5. Functional Requirements  
6. User Interface and User Experience  
7. Technology Stack  
8. System Architecture  
9. Mobile Repository Structure  
10. Backend Repository Structure  
11. React Native, Kotlin, and Swift Integration  
12. AI Provider Integration  
13. API Specifications  
14. Database Design  
15. Authentication and Cloud Synchronization  
16. Security and Privacy Requirements  
17. Non-Functional Requirements  
18. Error Handling  
19. Testing Strategy  
20. Git and Branch Management  
21. Development Roadmap  
22. Deployment Architecture  
23. Acceptance Criteria  
24. Future Enhancements  
25. Final Technical Decisions

# **1\. Project Overview**

## **1.1 Project Name**

AI Keyboard — AI-Powered Writing Assistant

## **1.2 Project Description**

AI Keyboard is a cross-platform mobile application that allows users to write, improve, rewrite, and generate messages directly inside supported applications using an AI-powered keyboard.

Users will be able to install the keyboard on Android and iOS devices and use its writing capabilities in messaging apps, email applications, social media, browsers, and other supported text fields.

The keyboard will provide grammar correction, spelling correction, professional rewriting, casual messaging, email generation, smart replies, text summarization, elaboration, explanations, and tone customization.

The application will support multiple AI providers, allowing users to configure their own API keys. Optional accounts will allow users to synchronize supported preferences between devices.

## **1.3 Core Product Concept**

The main idea is to provide an AI writing assistant directly inside the keyboard so users do not need to switch between their current application and a separate AI chat application.

Example:

A user types:

> i am sick today allow me work from home

The user selects:

* Action: Rewrite  
* Tone: Polite  
* Tone strength: Soft  
* Formality: Formal  
* Length: Normal

The application generates:

> I am feeling unwell today and would like to request permission to work from home. I will remain available online and ensure that my assigned tasks continue without interruption.

The user can preview, edit, copy, or insert the generated text into the current text field.

## **1.4 Key Product Features**

* AI-powered system keyboard.  
* Grammar and spelling correction.  
* Text rewriting and improvement.  
* Professional and casual writing.  
* Soft, balanced, and hard tone controls.  
* Email generation.  
* Smart replies.  
* Text summarization and elaboration.  
* Text explanation and continuation.  
* Multiple AI provider integrations.  
* Bring Your Own API Key (BYOK).  
* Optional accounts and cloud synchronization.  
* Secure credential storage.  
* Privacy and data controls.

# **2\. Vision and Objectives**

## **2.1 Product Vision**

To create a convenient, privacy-conscious AI keyboard that helps users communicate better in any supported application without repeatedly switching between applications.

## **2.2 Business Objectives**

1. Make AI writing assistance accessible from a system keyboard.  
2. Reduce the time required to write professional and personal messages.  
3. Support multiple writing styles and tones.  
4. Enable users to manage their own AI provider credentials and usage costs.  
5. Build a modular system that can support additional AI providers.  
6. Provide optional account-based synchronization.  
7. Keep the product maintainable through shared mobile logic and native platform integrations.

## **2.3 Technical Objectives**

* Use React Native and TypeScript for shared mobile application functionality.  
* Use Kotlin for Android keyboard integration.  
* Use Swift for iOS keyboard extension integration.  
* Use Node.js, Express.js, and TypeScript for the backend.  
* Use PostgreSQL and Prisma for relational data.  
* Use a common AI provider interface.  
* Define versioned API contracts.  
* Implement secure authentication and credential management.  
* Support automated testing and continuous integration.

# **3\. Scope of the Project**

## **3.1 In Scope**

The initial product will include the following capabilities.

| Module | Scope |
| ----- | ----- |
| Mobile application | React Native application for Android and iOS |
| Android keyboard | Native Kotlin keyboard service |
| iOS keyboard | Native Swift keyboard extension |
| AI writing | Grammar, rewriting, summarization, expansion, explanation |
| Tone management | Soft, balanced, hard, and configurable writing styles |
| Email writing | Generate and improve email subject lines and bodies |
| Smart replies | Generate replies from user-supplied message context |
| AI providers | OpenAI, Gemini, Anthropic, and future providers |
| API key management | Secure local storage and provider validation |
| Backend | Node.js and Express.js |
| Database | PostgreSQL with Prisma |
| Authentication | Optional accounts and session management |
| Cloud synchronization | User preferences and explicitly selected settings |
| Security | Secure storage, validation, privacy controls, and access control |
| Testing | Unit, integration, native, compatibility, and security testing |

## **3.2 Out of Scope for the Initial Release**

The initial release will not include:

* Automatic reading of entire conversations from other applications.  
* Automatic sending of messages or emails without user confirmation.  
* Sending every keystroke to an AI provider.  
* Automatic AI processing of passwords or other sensitive input.  
* Training AI models using private user messages.  
* Desktop keyboard applications.  
* Automatic synchronization of private message history.  
* Unlimited free AI usage provided by the platform.  
* Unrestricted access to other applications' screens or internal data.

These capabilities may be reconsidered in later releases only where the operating system, permissions, provider policies, and privacy requirements permit them.

# **4\. Target Users**

## **4.1 Professionals**

Users who write emails, workplace messages, meeting requests, reports, follow-ups, and business communication.

## **4.2 Students**

Users who need grammar correction, explanations, summaries, and clearer writing.

## **4.3 Social Media Users**

Users who create captions, comments, casual messages, and friendly or humorous replies.

## **4.4 General Mobile Users**

Users who want to improve everyday communication without leaving their current application.

## **4.5 Multilingual Users**

Users who want to write in supported languages and eventually use AI assistance for multilingual communication.

# **5\. Functional Requirements**

## **FR-01: Keyboard Installation and Activation**

The system shall allow users to install, enable, and select AI Keyboard through the relevant operating-system settings.

Requirements:

* Display onboarding instructions.  
* Explain keyboard activation and selection.  
* Explain relevant permissions.  
* Allow users to configure AI providers.  
* Allow users to skip account registration.  
* Provide access to settings after onboarding.  
* Display the keyboard's activation status when available.

Acceptance criteria:

* Users can follow the instructions to enable the keyboard.  
* The app does not falsely claim that the keyboard is enabled.  
* Users can continue using local settings without an account.

## **FR-02: Standard Keyboard Functionality**

The keyboard shall support ordinary typing independently of AI services.

Required features:

* Alphabetic keys.  
* Numeric and symbol layouts.  
* Shift and capitalization.  
* Space and enter.  
* Backspace.  
* Cursor-aware insertion.  
* Text deletion and selection replacement where supported.  
* Keyboard layout adaptation.  
* Lifecycle and orientation handling.

Acceptance criteria:

* Normal typing does not depend on network connectivity.  
* AI failures do not erase the user's draft.  
* The keyboard remains responsive while AI requests are pending.

## **FR-03: Grammar and Spelling Correction**

Users shall be able to correct spelling, grammar, punctuation, and sentence structure.

Example:

Input:

> i dont recieved your email yesterday

Output:

> I didn't receive your email yesterday.

Requirements:

* Preserve the original meaning.  
* Correct grammatical errors.  
* Correct spelling and punctuation.  
* Avoid adding unsupported information.  
* Allow preview before insertion.

## **FR-04: Text Rewriting**

Users shall be able to rewrite selected or manually supplied text.

Supported styles:

* Professional.  
* Casual.  
* Polite.  
* Funny.  
* Friendly.  
* Romantic.  
* Confident.  
* Empathetic.  
* Neutral.

The user shall be able to select a style independently of tone strength and length.

## **FR-05: Tone Strength**

The system shall provide three tone-strength options.

Soft

* Gentle and diplomatic.  
* Considerate and respectful.  
* Less confrontational.

Balanced

* Clear and natural.  
* Appropriately assertive.  
* Suitable for ordinary communication.

Hard

* Firm and direct.  
* Decisive and assertive.  
* Not unnecessarily abusive or aggressive.

Tone strength shall be independent of the selected writing style.

For example, the user can select Professional \+ Soft or Casual \+ Hard.

## **FR-06: Writing Length and Detail**

Users shall be able to select the desired length.

Supported options:

* Very short.  
* Short.  
* Normal.  
* Detailed.  
* Elaborate.

The AI should preserve essential information when shortening text and avoid inventing facts when expanding text.

## **FR-07: Summarization**

The system shall summarize user-supplied text.

Requirements:

* Preserve the main points.  
* Remove unnecessary details.  
* Support short and detailed summaries.  
* Avoid introducing unsupported claims.  
* Allow users to review the result before insertion.

## **FR-08: Text Expansion**

The system shall convert short notes into complete messages.

Example:

Input:

> meeting tomorrow ask time

Output:

> Hi, could you please confirm the time for tomorrow's meeting?

Requirements:

* Generate complete sentences.  
* Preserve the user's intent.  
* Avoid inventing dates, commitments, or factual details.  
* Respect the selected tone and formality.

## **FR-09: Text Explanation**

The system shall explain difficult text in simpler language.

Requirements:

* Provide clear explanations.  
* Use examples when requested.  
* Preserve the meaning of the original content.  
* Support a concise or detailed explanation.

## **FR-10: Continue Writing**

The system shall generate the next sentence or paragraph based on text supplied by the user.

The generated continuation must be previewed before insertion.

## **FR-11: Email Generation**

The system shall allow users to generate complete emails from short descriptions.

Required features:

* Generate a subject line.  
* Generate an email body.  
* Rewrite existing emails.  
* Generate follow-up emails.  
* Generate leave requests.  
* Generate meeting requests.  
* Generate thank-you emails.  
* Generate apologies.  
* Adjust tone, formality, and length.  
* Copy or insert the subject and body separately.

Example:

Input:

> ask manager work from home because sick

Output:

Subject: Request to Work from Home

Dear Sir,

I am feeling unwell today and would like to request permission to work from home. I will remain available online and ensure that my assigned tasks continue without interruption.

Thank you for your understanding.

## **FR-12: Smart Replies**

The system shall generate replies based on a message or conversation excerpt explicitly provided by the user.

Supported reply styles:

* Professional.  
* Friendly.  
* Funny.  
* Romantic.  
* Apologetic.  
* Empathetic.  
* Confident.  
* Polite.

Requirements:

* Generate multiple reply options where requested.  
* Support short and detailed replies.  
* Allow editing before insertion.  
* Avoid pretending to know conversation details that were not supplied.

The keyboard must not assume that it can read the entire conversation from WhatsApp, Instagram, Gmail, or another host application.

## **FR-13: Custom Instructions**

Users shall be able to define additional writing preferences.

Examples:

* Use simple English.  
* Avoid complicated words.  
* Keep replies under 50 words.  
* Use Indian English.  
* Do not add emojis.  
* Use emojis for casual messages.  
* Preserve names, dates, and technical terms.  
* Avoid unnecessary greetings.

Custom instructions shall be validated and applied according to the user's selected preferences.

## **FR-14: AI Result Preview**

Every AI operation shall provide a result that the user can review.

Available actions:

* Insert.  
* Replace selected text.  
* Copy.  
* Edit.  
* Regenerate.  
* Try another tone.  
* Cancel.

The original text should remain available until the user confirms the replacement.

## **FR-15: AI Provider Management**

The application shall support multiple AI providers through a common integration interface.

Initial providers:

* OpenAI.  
* Google Gemini.  
* Anthropic.

The implementation must verify current API capabilities and supported models for each provider.

Requirements:

* Add and configure provider credentials.  
* Test credentials.  
* Select a model.  
* Change the active provider.  
* Display connection status.  
* Handle provider-specific errors.  
* Add new providers without rewriting the entire application.

## **FR-16: Bring Your Own API Key**

Users shall be able to configure their own provider API keys.

Requirements:

* Add API key.  
* Test connection.  
* Replace API key.  
* Delete API key.  
* Display masked credentials.  
* Store keys securely on the device.  
* Never log or persist keys in the backend.  
* Explain that API billing is handled by the AI provider.

A ChatGPT subscription does not automatically include API credits. Provider API access and billing are separate.

## **FR-17: Optional Accounts**

Users shall be able to use the keyboard without registering an account.

Optional account features:

* Registration.  
* Login.  
* Logout.  
* Email verification where applicable.  
* Password reset where applicable.  
* Session revocation.  
* Account deletion.  
* Cloud preference synchronization.

## **FR-18: Cloud Synchronization**

The system shall synchronize selected non-sensitive preferences across devices.

Examples:

* Default writing style.  
* Default tone strength.  
* Default length.  
* Language preference.  
* Saved custom instructions, if synchronization is enabled.

API keys and message history shall not be synchronized by default.

## **FR-19: Privacy Controls**

The system shall provide:

* Privacy policy access.  
* Explanation of AI data transmission.  
* Local credential deletion.  
* Optional history deletion.  
* Cloud synchronization controls.  
* Account deletion.  
* Protection for sensitive input contexts.

AI requests shall be initiated explicitly by the user rather than on every keystroke.

# **6\. User Interface and User Experience**

## **6.1 Main Screens**

| Screen | Description |
| ----- | ----- |
| Welcome | Product introduction and onboarding |
| Keyboard Setup | Instructions to enable the keyboard |
| Home | Feature overview and settings access |
| AI Provider Settings | Provider selection, model, and API key |
| Writing Assistant | AI action, tone, length, and text input |
| Result Preview | Review and insert generated text |
| Email Generator | Subject and body generation |
| Smart Replies | Generate replies from supplied context |
| Account | Optional login and profile management |
| Sync Settings | Cloud preference synchronization |
| Privacy Settings | Permissions, data controls, and deletion |
| Usage | Usage information when available |

## **6.2 Keyboard Toolbar**

The keyboard toolbar should expose the most frequently used actions:

* Fix.  
* Rewrite.  
* Shorten.  
* Expand.  
* Reply.  
* Email.  
* More.

The More menu should provide Summarize, Explain, Continue Writing, and additional actions.

## **6.3 Tone Selector**

The tone selector shall allow independent configuration of:

* Writing style.  
* Tone strength.  
* Formality.  
* Length.  
* Language.

The selected options should be visible before generation.

## **6.4 Result Preview**

The preview should include:

* Generated text.  
* Edit controls.  
* Copy button.  
* Insert button.  
* Regenerate button.  
* Tone adjustment.  
* Loading and error states.

The keyboard must preserve the draft if a request fails or the user cancels.

# **7\. Technology Stack**

## **7.1 Mobile Application**

| Component | Technology |
| ----- | ----- |
| Shared mobile app | React Native |
| Programming language | TypeScript |
| Navigation | React Navigation |
| Server state | TanStack Query |
| Local preferences | AsyncStorage |
| Secure credentials | Platform-secure storage through a suitable native integration |
| Android keyboard | Kotlin |
| Android keyboard API | Android `InputMethodService` |
| iOS keyboard | Swift |
| iOS keyboard API | UIKit `UIInputViewController` |
| Shared UI | React Native components |

React Native will be responsible for the companion application, settings, account management, and shared application logic.

The native Android and iOS projects will handle system keyboard behavior.

## **7.2 Backend**

| Component | Technology |
| ----- | ----- |
| Runtime | Node.js |
| Framework | Express.js |
| Language | TypeScript |
| Validation | Zod |
| Database | PostgreSQL |
| ORM | Prisma |
| API documentation | OpenAPI 3.1 |
| Authentication | Short-lived access tokens and rotating refresh tokens |
| Testing | Jest or Vitest, Supertest |
| Deployment | Docker and managed container hosting |
| CI/CD | GitHub Actions |

## **7.3 AI Providers**

The backend shall use a common provider interface for OpenAI, Gemini, Anthropic, and future providers.

Each adapter shall handle provider-specific requests, authentication, response mapping, usage metadata, timeouts, and error normalization.

## **7.4 Additional Infrastructure**

Redis, distributed queues, and microservices are optional future enhancements. The initial system should use a modular backend and introduce additional infrastructure only when there is a demonstrated need.

# **8\. System Architecture**

## **8.1 High-Level Architecture**

The system consists of four major layers.

### **Layer 1: Host Applications**

Examples:

* WhatsApp.  
* Instagram.  
* Gmail.  
* Email clients.  
* Browsers.  
* Other supported text fields.

### **Layer 2: Mobile Application and Keyboard**

The mobile repository contains:

* React Native companion app.  
* Android native keyboard.  
* iOS native keyboard extension.  
* Shared API contracts and writing preferences.

### **Layer 3: Backend API**

The backend is responsible for:

* AI request validation.  
* Provider selection and routing.  
* Prompt construction.  
* Authentication.  
* Usage controls.  
* Cloud synchronization.  
* Error handling.

### **Layer 4: Data and AI Providers**

This layer contains:

* PostgreSQL.  
* AI provider APIs.  
* Operational monitoring.  
* Optional future caching and usage infrastructure.

## **8.2 Architectural Responsibilities**

| Component | Responsibility |
| ----- | ----- |
| React Native app | Onboarding, settings, accounts, provider configuration |
| Android keyboard | Key input, keyboard lifecycle, cursor handling, text insertion |
| iOS keyboard extension | Native keyboard interface, text proxy, text insertion |
| Shared contracts | Consistent API request and response structures |
| Backend API | Validation, provider routing, authentication, sync |
| Provider adapters | Provider-specific API integration |
| PostgreSQL | Accounts, preferences, sessions, sync metadata |
| Secure device storage | API keys and refresh credentials |

## **8.3 Architecture Principle**

The application should share business rules and API contracts without forcing all code into one runtime.

The native keyboards must be capable of performing their essential operations without requiring the React Native companion app to remain open.

# **9\. Mobile Repository Structure**

## **9.1 Repository Name**

`ai-keyboard-mobile`

## **9.2 Folder Structure**

ai-keyboard-mobile/  
│  
├── src/  
│   ├── app/  
│   │   ├── App.tsx  
│   │   └── navigation/  
│   │  
│   ├── screens/  
│   │   ├── WelcomeScreen.tsx  
│   │   ├── HomeScreen.tsx  
│   │   ├── ProviderSettingsScreen.tsx  
│   │   ├── ToneSettingsScreen.tsx  
│   │   ├── AccountScreen.tsx  
│   │   ├── SyncSettingsScreen.tsx  
│   │   └── PrivacySettingsScreen.tsx  
│   │  
│   ├── features/  
│   │   ├── ai-writing/  
│   │   │   ├── WritingActions.ts  
│   │   │   ├── writingTypes.ts  
│   │   │   └── writingValidation.ts  
│   │   ├── tone-selector/  
│   │   ├── email-generator/  
│   │   ├── smart-replies/  
│   │   ├── provider-management/  
│   │   └── authentication/  
│   │  
│   ├── components/  
│   │   ├── Button.tsx  
│   │   ├── ToneSelector.tsx  
│   │   ├── LengthSelector.tsx  
│   │   ├── ProviderCard.tsx  
│   │   └── GeneratedTextPreview.tsx  
│   │  
│   ├── services/  
│   │   ├── apiClient.ts  
│   │   ├── aiService.ts  
│   │   ├── authService.ts  
│   │   └── syncService.ts  
│   │  
│   ├── storage/  
│   │   ├── preferencesStore.ts  
│   │   └── secureStorage.ts  
│   │  
│   ├── hooks/  
│   ├── types/  
│   └── utils/  
│  
├── android/  
│   └── app/src/main/  
│       ├── AndroidManifest.xml  
│       ├── java/com/aikeyboard/  
│       │   ├── MainActivity.kt  
│       │   ├── keyboard/  
│       │   │   ├── AIKeyboardService.kt  
│       │   │   ├── KeyboardView.kt  
│       │   │   ├── KeyboardController.kt  
│       │   │   ├── InputConnectionManager.kt  
│       │   │   └── KeyboardPreferences.kt  
│       │   └── bridge/  
│       │       └── KeyboardBridgeModule.kt  
│       └── res/xml/  
│           └── keyboard\_method.xml  
│  
├── ios/  
│   ├── AIKeyboardApp/  
│   │   └── AppDelegate.swift  
│   ├── AIKeyboardExtension/  
│   │   ├── KeyboardViewController.swift  
│   │   ├── KeyboardView.swift  
│   │   ├── KeyboardController.swift  
│   │   ├── TextDocumentProxyAdapter.swift  
│   │   └── Info.plist  
│   └── Shared/  
│       ├── KeyboardConfiguration.swift  
│       └── SharedPreferences.swift  
│  
├── shared-contracts/  
│   ├── openapi.yaml  
│   ├── ai-request.schema.json  
│   └── ai-response.schema.json  
│  
├── tests/  
│   ├── unit/  
│   ├── integration/  
│   └── fixtures/  
│  
├── docs/  
│   ├── SRS.md  
│   ├── ARCHITECTURE.md  
│   ├── API.md  
│   ├── SECURITY.md  
│   └── DEVELOPMENT.md  
│  
├── package.json  
├── tsconfig.json  
├── .gitignore  
├── .env.example  
└── README.md

This is the intended logical structure. Exact native file locations may vary with the React Native project template and native extension configuration.

## **9.3 Folder Responsibilities**

| Folder | Purpose |
| ----- | ----- |
| `src/screens/` | Companion app screens |
| `src/features/` | AI actions, tone selection, replies, email |
| `src/components/` | Reusable React Native components |
| `src/services/` | Backend communication |
| `src/storage/` | Preferences and secure storage abstraction |
| `android/` | Android native application and keyboard service |
| `ios/` | iOS application and keyboard extension |
| `shared-contracts/` | Shared API schemas |
| `tests/` | Automated tests |
| `docs/` | Project documentation |

# **10\. Backend Repository Structure**

## **10.1 Repository Name**

`ai-keyboard-api`

## **10.2 Folder Structure**

ai-keyboard-api/  
│  
├── src/  
│   ├── app.ts  
│   ├── server.ts  
│   │  
│   ├── config/  
│   │   ├── env.ts  
│   │   └── database.ts  
│   │  
│   ├── routes/  
│   │   ├── ai.routes.ts  
│   │   ├── auth.routes.ts  
│   │   ├── provider.routes.ts  
│   │   ├── user.routes.ts  
│   │   └── sync.routes.ts  
│   │  
│   ├── controllers/  
│   ├── middleware/  
│   ├── validators/  
│   ├── repositories/  
│   │  
│   ├── services/  
│   │   ├── ai/  
│   │   │   ├── AIProvider.ts  
│   │   │   ├── ProviderRegistry.ts  
│   │   │   ├── OpenAIProvider.ts  
│   │   │   ├── GeminiProvider.ts  
│   │   │   └── AnthropicProvider.ts  
│   │   ├── auth/  
│   │   ├── sync/  
│   │   └── usage/  
│   │  
│   ├── prompts/  
│   │   ├── grammar.prompt.ts  
│   │   ├── rewrite.prompt.ts  
│   │   ├── summarize.prompt.ts  
│   │   ├── expand.prompt.ts  
│   │   ├── explain.prompt.ts  
│   │   ├── reply.prompt.ts  
│   │   └── email.prompt.ts  
│   │  
│   └── errors/  
│  
├── prisma/  
│   ├── schema.prisma  
│   └── migrations/  
│  
├── tests/  
│   ├── unit/  
│   ├── integration/  
│   └── contract/  
│  
├── docs/  
├── Dockerfile  
├── docker-compose.yml  
├── package.json  
├── tsconfig.json  
├── .env.example  
└── README.md

## **10.3 Backend Responsibilities**

The backend shall:

1. Accept validated AI requests.  
2. Route requests to the selected provider.  
3. Construct action-specific prompts.  
4. Apply rate limits and request timeouts.  
5. Normalize provider responses.  
6. Manage optional user authentication.  
7. Synchronize supported preferences.  
8. Record minimal operational metadata.  
9. Protect credentials and sensitive data.  
10. Provide consistent error responses.

# **11\. React Native, Kotlin, and Swift Integration**

## **11.1 React Native Responsibilities**

React Native shall implement:

* Companion application screens.  
* Navigation.  
* Onboarding.  
* Provider settings.  
* API key configuration UI.  
* Writing preferences.  
* Account management.  
* Cloud sync settings.  
* API client and shared TypeScript models.  
* Common AI action definitions.

## **11.2 Android Responsibilities**

Kotlin shall implement:

* `InputMethodService`.  
* Native keyboard lifecycle.  
* Keyboard layout and key handling.  
* `InputConnection` interactions.  
* Cursor-aware text insertion.  
* Selection replacement where supported.  
* Native networking integration where required.  
* Keyboard permissions and sensitive-field handling.

## **11.3 iOS Responsibilities**

Swift shall implement:

* `UIInputViewController`.  
* Native keyboard layout.  
* `UITextDocumentProxy` interactions.  
* Cursor-aware insertion.  
* Supported text context retrieval.  
* Extension lifecycle.  
* Full-access permission handling where applicable.  
* Shared preference integration where appropriate.

## **11.4 Communication Rules**

* React Native and the native keyboard code may share the same repository.  
* They do not automatically share one runtime.  
* The iOS extension may operate independently of the React Native app.  
* The keyboard must not depend on the companion app being open.  
* Both keyboards must use compatible API contracts.  
* Native code shall handle platform-specific input operations.  
* AI requests must not be triggered automatically on every keystroke.

# **12\. AI Provider Integration**

## **12.1 Provider Abstraction**

The backend shall implement a common provider interface.

Example:

export interface AIProvider {  
  readonly providerId: string;

  generate(  
    request: AIProviderRequest  
  ): Promise\<AIProviderResponse\>;

  validateCredentials(): Promise\<{  
    valid: boolean;  
    message?: string;  
  }\>;  
}

export interface AIProviderRequest {  
  model: string;  
  systemPrompt: string;  
  userText: string;  
  temperature?: number;  
  maxOutputTokens?: number;  
}

export interface AIProviderResponse {  
  text: string;  
  model: string;  
  inputTokens?: number;  
  outputTokens?: number;  
}

## **12.2 Provider Adapter Responsibilities**

Each adapter shall implement:

* Credential handling.  
* Model validation.  
* Request mapping.  
* Response mapping.  
* Provider-specific timeout handling.  
* Rate-limit and quota error handling.  
* Usage metadata extraction where available.  
* Cancellation where supported.

## **12.3 Adding a New Provider**

To add a provider:

1. Implement the common interface.  
2. Add provider-specific configuration.  
3. Add credential validation.  
4. Define supported model capabilities.  
5. Map provider errors into common errors.  
6. Add unit and contract tests.  
7. Register the adapter.

The mobile UI should not need a complete redesign whenever a new provider is added.

# **13\. API Specifications**

## **13.1 API Base URL**

Development example:

`http://localhost:3000`

Production format:

`https://api.example.com/v1`

The production hostname is a placeholder and must be replaced with the deployed backend domain.

## **13.2 API Conventions**

* REST API.  
* JSON request and response bodies.  
* Versioned endpoints.  
* HTTPS in production.  
* Server-side validation.  
* Request-size limits.  
* Rate limiting.  
* Consistent error format.  
* No sensitive credentials in logs or URLs.

## **13.3 Endpoint Inventory**

| Method | Endpoint | Purpose |
| ----- | ----- | ----- |
| GET | `/health` | Liveness check |
| GET | `/v1/health/ready` | Dependency readiness |
| POST | `/v1/ai/generate` | Generate or transform text |
| GET | `/v1/ai/providers` | List supported providers |
| POST | `/v1/ai/providers/test` | Validate provider access |
| GET | `/v1/ai/usage` | Retrieve available usage information |
| POST | `/v1/auth/register` | Register a user |
| POST | `/v1/auth/login` | Authenticate |
| POST | `/v1/auth/refresh` | Refresh session |
| POST | `/v1/auth/logout` | Revoke session |
| GET | `/v1/users/me` | Retrieve profile |
| GET | `/v1/sync/preferences` | Retrieve preferences |
| PUT | `/v1/sync/preferences` | Update preferences |
| DELETE | `/v1/users/me` | Request account deletion |

Guest access should use short-lived, scoped credentials rather than a universal secret embedded in the mobile application.

## **13.4 AI Generation Request**

Endpoint:

`POST /v1/ai/generate`

Example request:

{  
  "provider": "openai",  
  "model": "configured-model",  
  "action": "rewrite",  
  "text": "i am sick today allow me work from home",  
  "settings": {  
    "tone": "polite",  
    "toneStrength": "soft",  
    "formality": "formal",  
    "length": "normal",  
    "language": "en-IN"  
  },  
  "customInstructions": \[  
    "Use simple English",  
    "Preserve the original meaning"  
  \],  
  "options": {  
    "stream": false  
  }  
}

The model identifier is illustrative. The backend must validate it against the provider's available models.

## **13.5 AI Generation Response**

{  
  "requestId": "req\_example123",  
  "success": true,  
  "result": "I am feeling unwell today and would like to request permission to work from home.",  
  "provider": "openai",  
  "model": "actual-model-id",  
  "usage": {  
    "inputTokens": 24,  
    "outputTokens": 20  
  }  
}

Token counts are optional and should be omitted when the provider does not supply them.

## **13.6 API Validation**

The backend must validate:

* Provider identifier.  
* Model identifier.  
* Action enum.  
* Text content and maximum length.  
* Tone and tone strength.  
* Formality.  
* Desired length.  
* Language.  
* Custom instruction count and length.  
* Total request size.  
* Credentials and access permissions.

## **13.7 Standard Error Response**

{  
  "error": {  
    "code": "PROVIDER\_RATE\_LIMITED",  
    "message": "The AI provider is temporarily rate-limiting requests.",  
    "requestId": "req\_example123",  
    "retryable": true  
  }  
}

Recommended error codes:

| Code | HTTP Status |
| ----- | ----- |
| `VALIDATION_ERROR` | 400 |
| `UNAUTHENTICATED` | 401 |
| `FORBIDDEN` | 403 |
| `INVALID_PROVIDER_KEY` | 422 |
| `PROVIDER_RATE_LIMITED` | 429 |
| `PROVIDER_UNAVAILABLE` | 503 |
| `REQUEST_TOO_LARGE` | 413 |
| `INTERNAL_ERROR` | 500 |

Do not expose raw provider exceptions, stack traces, or secrets.

# **14\. Database Design**

## **14.1 Database**

PostgreSQL will store optional user accounts, preferences, session metadata, and synchronization information.

## **14.2 Core Tables**

| Table | Purpose |
| ----- | ----- |
| `users` | User account data |
| `sessions` | Refresh token hashes, expiry, and revocation |
| `devices` | Registered device metadata |
| `user_preferences` | Synced writing preferences |
| `sync_versions` | Synchronization version tracking |
| `usage_events` | Minimal request metadata, if usage tracking is enabled |
| `account_deletion_jobs` | Asynchronous deletion tracking where required |

## **14.3 User Table**

Fields:

* `id`  
* `email`  
* `passwordHash`  
* `createdAt`  
* `updatedAt`

## **14.4 User Preferences Table**

Fields:

* `userId`  
* `defaultTone`  
* `toneStrength`  
* `defaultLength`  
* `language`  
* `version`  
* `updatedAt`

## **14.5 Device Table**

Fields:

* `id`  
* `userId`  
* `platform`  
* `lastSeenAt`  
* `createdAt`

## **14.6 Session Table**

Fields:

* `id`  
* `userId`  
* `tokenHash`  
* `expiresAt`  
* `revokedAt`  
* `createdAt`

## **14.7 Data Retention**

* User account data shall be retained while the account is active.  
* Preferences shall be retained until changed or deleted.  
* Sessions shall expire and be pruned according to policy.  
* Message contents shall not be stored by default.  
* Provider API keys shall not be persisted by the backend.  
* Account deletion shall revoke sessions and remove applicable synchronized data, subject to disclosed legal retention requirements.

# **15\. Authentication and Cloud Synchronization**

## **15.1 Authentication**

The application shall support optional accounts.

Security requirements:

* Hash passwords using a suitable password hashing algorithm, such as Argon2id.  
* Use short-lived access tokens.  
* Rotate refresh tokens.  
* Detect refresh token reuse.  
* Revoke sessions on logout.  
* Rate-limit authentication attempts.  
* Protect password reset flows.  
* Do not expose access tokens in URLs.

## **15.2 Cloud Synchronization**

The system shall synchronize explicitly supported preferences.

Example:

{  
  "version": 12,  
  "preferences": {  
    "defaultTone": "professional",  
    "toneStrength": "soft",  
    "defaultLength": "normal",  
    "language": "en-IN"  
  }  
}

The backend should use optimistic concurrency control to prevent older settings from silently overwriting newer settings.

## **15.3 Offline Behavior**

* Local preferences should remain available offline.  
* Normal typing must work offline.  
* AI requests should display an appropriate network error.  
* Drafts must not be lost because of a failed request.  
* Only eligible preference updates should be queued for synchronization.  
* Message contents should not be queued for automatic transmission.

# **16\. Security and Privacy Requirements**

## **16.1 API Key Security**

* Store provider keys using Android Keystore-backed storage or iOS Keychain.  
* Do not store keys in ordinary preferences.  
* Never commit keys to Git.  
* Never log keys.  
* Never place keys in URLs.  
* Use HTTPS.  
* Do not persist BYOK credentials in the backend database.  
* Redact credential headers from monitoring and tracing.  
* Clear request-scoped credential references after processing.

Because the backend receives the credential to forward a request, the backend is not zero-knowledge. Users must be informed that their provider requests pass through the service.

## **16.2 Keyboard Privacy**

* Never transmit every keystroke to the AI provider.  
* Process text only after explicit user action.  
* Avoid AI processing in passwords and sensitive input fields.  
* Do not automatically read entire conversations from host applications.  
* Explain when text is sent to an AI provider.  
* Do not collect message contents in analytics.  
* Provide local and cloud data deletion controls.

## **16.3 Authentication Security**

* Enforce authorization on the backend.  
* Never trust client-supplied user IDs as proof of ownership.  
* Protect refresh credentials.  
* Revoke sessions on logout and account deletion.  
* Use database constraints and ownership checks.

## **16.4 Prompt and Output Security**

* Treat user-supplied text as untrusted input.  
* Separate system instructions from user content.  
* Do not treat generated text as executable code.  
* Do not allow prompt content to bypass server-side authorization.  
* Validate output formats before returning structured data.

# **17\. Non-Functional Requirements**

| ID | Requirement | Initial Target |
| ----- | ----- | ----- |
| NFR-01 | Keyboard responsiveness | Ordinary typing must not wait for AI |
| NFR-02 | AI response time | Aim for 2–5 seconds for typical short requests, subject to provider performance |
| NFR-03 | Backend overhead | p95 below 300 ms excluding provider latency, under a defined test load |
| NFR-04 | Availability | Initial service target of 99.5% monthly |
| NFR-05 | Security | No known API keys in logs or analytics |
| NFR-06 | Privacy | Only necessary text is transmitted |
| NFR-07 | Reliability | Failed requests must not erase drafts |
| NFR-08 | Maintainability | Modular services and typed contracts |
| NFR-09 | Accessibility | Screen-reader support and usable touch targets |
| NFR-10 | Compatibility | Test supported Android and iOS versions and host apps |

These are proposed engineering targets that must be validated through testing.

# **18\. Error Handling**

| Scenario | Expected Behavior |
| ----- | ----- |
| Missing API key | Prompt user to configure a provider |
| Invalid key | Explain the error and allow key replacement |
| Insufficient quota | Explain that provider billing or quota may need attention |
| Network unavailable | Preserve draft and offer retry |
| Provider rate limit | Show retry guidance |
| Unsupported model | Ask user to select an available model |
| Empty input | Request text before generation |
| Empty AI response | Show error and offer regeneration |
| Keyboard loses focus | Avoid inserting into an unrelated field |
| User cancels | Discard pending result without modifying the draft |
| Cloud sync conflict | Detect the conflict and reconcile versions |
| Account deleted | Revoke sessions and remove applicable synchronized data |

The application shall not expose raw provider errors, stack traces, or credentials.

# **19\. Testing Strategy**

## **19.1 Backend Tests**

* Unit tests for validation and prompt construction.  
* Provider adapter tests.  
* Authentication and authorization tests.  
* API integration tests.  
* Synchronization conflict tests.  
* Rate-limit and timeout tests.  
* Credential redaction tests.

## **19.2 React Native Tests**

* Component tests.  
* Navigation tests.  
* Provider configuration tests.  
* API client tests.  
* Secure storage integration tests.  
* Accessibility tests.  
* Authentication flow tests.

## **19.3 Android Tests**

* Keyboard activation.  
* Standard typing.  
* Key deletion.  
* Cursor-aware insertion.  
* Selection replacement.  
* Keyboard lifecycle.  
* Sensitive input handling.  
* Offline behavior.

## **19.4 iOS Tests**

* Extension activation.  
* Text insertion.  
* Cursor and text proxy behavior.  
* Full-access restrictions.  
* Host application compatibility.  
* Extension lifecycle.  
* Shared preference access.  
* Offline behavior.

## **19.5 End-to-End Tests**

* Type text.  
* Select an AI action.  
* Generate the result.  
* Preview the result.  
* Insert the result.  
* Confirm the original text is preserved when generation fails.

## **19.6 Security Tests**

* API keys never appear in logs.  
* One user cannot access another user's data.  
* Sessions can be revoked.  
* Sensitive input does not trigger AI.  
* Invalid requests are rejected.  
* Account deletion removes applicable data.  
* Dependency vulnerability scanning is included in CI.

# **20\. Git and Branch Management**

## **20.1 Repository Strategy**

Use two repositories.

Repository 1: `ai-keyboard-mobile`

Contains:

* React Native code.  
* Kotlin code.  
* Swift code.  
* Shared contracts.  
* Mobile tests.  
* Mobile documentation.

Repository 2: `ai-keyboard-api`

Contains:

* Node.js and Express.js.  
* AI provider adapters.  
* Database schemas and migrations.  
* Authentication.  
* Cloud synchronization.  
* Backend tests.  
* Deployment configuration.

## **20.2 Branch Strategy**

The mobile repository can use:

* `main`  
* `feature/react-native-app`  
* `feature/android-keyboard`  
* `feature/ios-keyboard`  
* `feature/ai-writing`  
* `feature/provider-settings`

The backend repository can use:

* `main`  
* `feature/ai-generation-api`  
* `feature/ai-provider-adapters`  
* `feature/auth-and-sync`

These feature branches are optional. All mobile code can be committed to `main` because React Native, Kotlin, and Swift are tracked by the same Git repository.

## **20.3 Commit Convention**

Examples:

feat(mobile): add provider settings screen  
feat(android): implement keyboard service  
feat(ios): implement keyboard extension  
feat(ai): add rewrite action  
feat(api): add AI generation endpoint  
feat(auth): add refresh token rotation  
fix(keyboard): preserve draft after request failure  
test(api): add provider contract tests  
docs: update architecture specification

# **21\. Development Roadmap**

The following timeline is an initial estimate for a small, experienced development team.

## **Phase 1: Foundation — Week 1**

Tasks:

* Create both repositories.  
* Set up React Native with TypeScript.  
* Create Android and iOS native projects.  
* Initialize Express.js backend.  
* Configure PostgreSQL and Prisma.  
* Define OpenAPI contracts.  
* Configure linting, testing, and CI.

Deliverable: Both mobile builds and the backend start successfully.

## **Phase 2: Native Keyboard — Weeks 2–3**

Tasks:

* Implement Android `InputMethodService`.  
* Implement iOS keyboard extension.  
* Add ordinary typing and key handling.  
* Implement cursor-aware insertion.  
* Test permissions and sensitive input.  
* Verify offline typing.

Deliverable: Functional keyboards without AI integration.

## **Phase 3: AI Integration — Weeks 4–5**

Tasks:

* Implement provider abstraction.  
* Integrate the first AI provider.  
* Implement secure BYOK handling.  
* Build the generation API.  
* Implement grammar, rewrite, summarize, and expand.  
* Add result preview and insertion.

Deliverable: AI writing works from both keyboards.

## **Phase 4: Writing Features — Weeks 6–7**

Tasks:

* Add tone and length controls.  
* Add email generation.  
* Add smart replies.  
* Integrate additional providers.  
* Complete provider configuration UI.  
* Improve error handling.

Deliverable: Core AI writing features work across platforms.

## **Phase 5: Accounts and Sync — Week 8**

Tasks:

* Implement optional registration and login.  
* Add session management.  
* Implement cloud preferences.  
* Add conflict handling.  
* Add account deletion and synchronization controls.

Deliverable: Optional accounts and cross-device preference sync.

## **Phase 6: Testing and Release — Week 9**

Tasks:

* Complete compatibility tests.  
* Perform security testing.  
* Test network failures and provider outages.  
* Deploy backend to staging and production.  
* Prepare release builds and privacy documentation.  
* Conduct beta testing.

Deliverable: Beta-ready Android and iOS applications.

The overall estimate is approximately 8–9 weeks, but native keyboard development, extension restrictions, store reviews, and compatibility testing may extend the timeline.

# **22\. Deployment Architecture**

## **22.1 Production Components**

* Android application distribution.  
* iOS application distribution.  
* HTTPS ingress.  
* Node.js/Express.js backend.  
* PostgreSQL database.  
* AI provider APIs.  
* Monitoring and alerting.  
* Database backups.

## **22.2 Deployment Requirements**

* Separate development, staging, and production environments.  
* Use database migrations.  
* Protect production secrets.  
* Configure health checks.  
* Configure request and connection timeouts.  
* Apply request-size limits.  
* Configure structured logging with redaction.  
* Monitor latency and errors.  
* Back up the database.  
* Test restoration procedures.  
* Scan dependencies for vulnerabilities.  
* Define rollback procedures.

A modular Express.js application is sufficient for the initial release. Microservices, distributed queues, and Redis can be introduced when justified by scale or operational requirements.

# **23\. Acceptance Criteria**

The MVP shall be considered ready for beta release when the following conditions are satisfied.

## **Mobile**

* React Native application runs on Android and iOS.  
* Android keyboard can be enabled and selected.  
* iOS keyboard extension can be enabled and used where supported.  
* Ordinary typing works without network access.  
* AI failures do not erase drafts.  
* Results can be previewed and inserted.

## **AI**

* Grammar correction works.  
* Rewrite and tone controls work.  
* Shorten and expand work.  
* Summarize and explain work.  
* Email generation works.  
* Smart replies use user-supplied context.  
* Multiple provider adapters follow the common interface.

## **Backend**

* API requests are validated.  
* Provider errors are normalized.  
* Authentication and authorization are tested.  
* Cloud sync detects conflicting updates.  
* User data is isolated by account.

## **Security**

* Provider API keys are not persisted or logged by the backend.  
* Secure local credential storage is implemented.  
* Sensitive input contexts are handled safely.  
* Privacy disclosures are available.  
* Account deletion and session revocation work.  
* No AI requests occur automatically on every keystroke.

## **Release**

* Automated tests pass.  
* Production builds are reproducible.  
* Monitoring and backups are configured.  
* Privacy policy and onboarding documentation are complete.

# **24\. Future Enhancements**

Potential future features include:

* More AI providers.  
* Additional languages.  
* Voice-to-text and AI-assisted dictation.  
* Advanced custom writing presets.  
* Optional writing history.  
* Cross-device preference synchronization.  
* Additional personalization.  
* Subscription plans for platform-managed AI access.  
* Desktop companion applications.  
* More sophisticated context-aware suggestions.

Each feature must be evaluated against platform restrictions, privacy, cost, and maintenance requirements.

# **25\. Final Technical Decisions**

The following decisions form the initial project baseline.

| Area | Final Decision |
| ----- | ----- |
| Mobile repository | One repository for React Native, Kotlin, and Swift |
| Mobile framework | React Native \+ TypeScript |
| Android keyboard | Kotlin \+ `InputMethodService` |
| iOS keyboard | Swift \+ UIKit keyboard extension |
| Backend repository | Separate repository |
| Backend stack | Node.js \+ Express.js \+ TypeScript |
| Database | PostgreSQL \+ Prisma |
| AI integration | Provider-independent adapter pattern |
| Initial providers | OpenAI, Gemini, Anthropic |
| API design | Versioned REST API with OpenAPI contracts |
| Authentication | Optional accounts and rotating refresh tokens |
| Cloud synchronization | Preferences and explicitly enabled non-sensitive settings |
| API keys | Secure local storage; no backend persistence |
| Message history | Disabled by default |
| Git | One mobile repository with shared branches |
| Testing | Backend, React Native, Android, iOS, integration, and security tests |
| Deployment | Modular backend with managed database and monitoring |

## **Final Recommendation**

Build the product in this order:

1. Create the mobile and backend repositories.  
2. Set up the React Native application.  
3. Implement basic Android and iOS keyboard functionality natively.  
4. Define the shared API contracts.  
5. Integrate the first AI provider.  
6. Implement the core writing features.  
7. Add multiple providers.  
8. Add optional accounts and cloud synchronization.  
9. Complete security, privacy, and compatibility testing.  
10. Release a beta version and improve it using user feedback.

The central architectural principle is to share the application logic without forcing every component into the same runtime. React Native will handle the companion application, Kotlin will handle Android keyboard operations, Swift will handle iOS keyboard operations, and the separate Node.js backend will handle AI orchestration and cloud functionality.

This structure provides a maintainable foundation for a cross-platform AI Keyboard while allowing additional providers, writing tools, and account features to be introduced incrementally.


# NeuraStitch AI Beta Testing Forms

This document contains the copy-pasteable fields and structure for your Google Forms during the closed beta testing phase.

---

## 📋 Form 1: Closed Beta Sign-Up & Whitelisting

**Form Title:**  
`NeuraStitch AI - Closed Beta Access Sign-Up`

**Form Description:**  
`Thank you for your interest in testing NeuraStitch AI, the visual branching canvas and decoupled memory fabric for AI agents. Please fill out this quick form so we can whitelist your email and grant you access to the beta playground.`

### Fields Configuration

1. **Full Name**
   - **Type:** Short Answer
   - **Required:** Yes

2. **Google Account Email Address**
   - **Type:** Short Answer
   - **Required:** Yes
   - **Description:** `Provide the exact Google/Gmail address you will use to log in. We must whitelist this email in the Google Console or your login attempt will be blocked.`
   - **Validation:** Set Response Validation to "Text" -> "Email"

3. **What is your primary background/role?**
   - **Type:** Multiple Choice
   - **Required:** Yes
   - **Options:**
     - Software Developer / Engineer
     - AI / ML Practitioner
     - Product Manager / Designer
     - Researcher / Academic
     - Tech Enthusiast / Hobbyist
     - Other

4. **Which LLM providers do you currently use the most?**
   - **Type:** Checkboxes
   - **Required:** Yes
   - **Options:**
     - OpenAI (GPT)
     - Google (Gemini)
     - Anthropic (Claude)
     - Meta/Groq (LLaMA)
     - OpenRouter / Others

---

## 💬 Form 2: End-of-Beta Feedback (Send After 2 Weeks)

**Form Title:**  
`NeuraStitch AI - Beta Feedback Survey`

**Form Description:**  
`Thank you for testing NeuraStitch AI over the last two weeks! Your feedback is vital to help us improve the product before our public launch. This survey takes about 3 minutes.`

### Fields Configuration

1. **Email Address**
   - **Type:** Short Answer
   - **Required:** No
   - **Description:** `Used to link your feedback with your PostHog logs (optional).`

2. **Overall, how would you rate your experience with NeuraStitch?**
   - **Type:** Linear Scale (1 to 10)
   - **Required:** Yes
   - **Labels:** `1 - Very Poor` to `10 - Exceptional`

3. **How useful did you find the Visual Version-Control Canvas (React Flow tree)?**
   - **Type:** Multiple Choice
   - **Required:** Yes
   - **Options:**
     - Very Useful (I branched my thoughts frequently)
     - Moderately Useful (I occasionally created branches)
     - Not Useful (I preferred typing in a linear chat window)

4. **Did the AI personalize its responses correctly using the Memory Vault facts?**
   - **Type:** Multiple Choice
   - **Required:** Yes
   - **Options:**
     - Yes, it felt highly personalized and remembered details accurately
     - Yes, but it made occasional errors
     - No, it did not feel personalized
     - I turned off profile memory sharing in settings

5. **How would you rate the speed and latency of the message streaming?**
   - **Type:** Multiple Choice
   - **Required:** Yes
   - **Options:**
     - Fast and responsive
     - Acceptable
     - Slow (long wait times before tokens streamed)

6. **What is the #1 feature we should add before launching to the public?**
   - **Type:** Paragraph
   - **Required:** Yes

7. **Did you encounter any bugs, errors, or page crashes? If yes, please describe them.**
   - **Type:** Paragraph
   - **Required:** No

8. **Once we go public, would you pay for a premium subscription (e.g., $10/month for cloud syncing, persistent profiles, and larger vector databases)?**
   - **Type:** Multiple Choice
   - **Required:** Yes
   - **Options:**
     - Yes, absolutely
     - Yes, if more advanced features are added
     - No, I only use free tools

9. **Any final suggestions or thoughts for the developer team?**
   - **Type:** Paragraph
   - **Required:** No

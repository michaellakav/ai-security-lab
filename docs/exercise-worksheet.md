# AI Security Lab - Exercise Worksheet

Use this worksheet to document your findings during the training exercises.

---

## Module 1: Direct Prompt Injection

### Exercise 1.1: System Prompt Extraction

**Objective:** Extract the hidden system prompt from the chatbot

**Techniques tried:**

| Technique | Prompt Used | Result |
|-----------|-------------|--------|
| Direct request | | |
| Role-play | | |
| Translation | | |
| Encoding | | |

**Flag found:** `FLAG{_____________________}`

**What defenses could prevent this?**
- [ ] 
- [ ] 
- [ ] 

---

### Exercise 1.2: Jailbreak Attempts

**Objective:** Make the chatbot discuss "forbidden" topics (competitors)

**Successful technique:**

```
[Your successful prompt here]
```

**Why did this work?**



---

## Module 2: Indirect Prompt Injection

### Exercise 2.1: URL Summarizer Attacks

**Test each attack page and document results:**

| Attack Page | Injection Technique | Did AI Follow Instructions? | Notes |
|-------------|--------------------|-----------------------------|-------|
| innocent-article.html | None (baseline) | N/A | |
| attack-comment.html | HTML comments | Yes / No / Partial | |
| attack-invisible.html | CSS hidden text | Yes / No / Partial | |
| attack-alt.html | Image alt text | Yes / No / Partial | |
| attack-unicode.html | Unicode obfuscation | Yes / No / Partial | |
| attack-exfil.html | Tool invocation | Yes / No / Partial | |

**Most effective technique:**

**Why do you think this worked?**



### Exercise 2.2: Create Your Own Attack

**Design a novel injection technique not covered in the lab:**

**Attack name:**

**How it works:**

**HTML/payload:**

```html
[Your attack code here]
```

**Test results:**

---

## Module 3: MCP Server Vulnerabilities

### Exercise 3.1: Vulnerability Identification

**Review the vulnerable MCP server code and identify all vulnerabilities:**

| Endpoint | Vulnerability Type | Severity | Impact |
|----------|-------------------|----------|--------|
| /tools/file_read | | High / Med / Low | |
| /tools/file_write | | High / Med / Low | |
| /tools/run_command | | High / Med / Low | |
| /tools/search_database | | High / Med / Low | |
| /tools/send_email | | High / Med / Low | |
| /tools/fetch_url | | High / Med / Low | |

### Exercise 3.2: Exploitation

**Document your successful exploits:**

**Exploit 1: Path Traversal**
```bash
curl -X POST http://localhost:3001/tools/file_read \
  -H "Content-Type: application/json" \
  -d '{"path": "_______________"}'
```
**What did you access?**


**Exploit 2: Command Injection**
```bash
curl -X POST http://localhost:3001/tools/run_command \
  -H "Content-Type: application/json" \
  -d '{"command": "_______________"}'
```
**What commands did you run?**


**Exploit 3: Data Exfiltration**
```bash
[Your exploit here]
```
**What data did you extract?**


---

## Module 4: Gateway Defenses

### Exercise 4.1: Policy Analysis

**Review gateway/policies.yaml and answer:**

1. Which tools require user confirmation?


2. What email domains are blocked?


3. What file patterns are blocked?


4. What injection patterns are detected?


### Exercise 4.2: Policy Bypass Attempts

**Try to bypass the gateway policies:**

| Policy | Bypass Technique Tried | Success? | Notes |
|--------|----------------------|----------|-------|
| Email domain restriction | | Yes / No | |
| File path restriction | | Yes / No | |
| Injection detection | | Yes / No | |

### Exercise 4.3: Add New Policies

**Propose 3 new policies to add to the gateway:**

1. **Policy:**
   **Rationale:**

2. **Policy:**
   **Rationale:**

3. **Policy:**
   **Rationale:**

---

## Module 5: Red Team / Blue Team

### If Red Team:

**Attack 1:**
- Name:
- Category: Direct / Indirect / Tool Abuse
- Target:
- Payload:
- Result:

**Attack 2:**
- Name:
- Category:
- Target:
- Payload:
- Result:

**Attack 3:**
- Name:
- Category:
- Target:
- Payload:
- Result:

### If Blue Team:

**Defense 1:**
- Name:
- Layer: Input / Processing / Output / Gateway
- Implementation:
- Attacks blocked:

**Defense 2:**
- Name:
- Layer:
- Implementation:
- Attacks blocked:

**Defense 3:**
- Name:
- Layer:
- Implementation:
- Attacks blocked:

---

## Module 6: Incident Response

### Tabletop Exercise Notes

**Phase 1: Detection**
- First log to examine:
- How to distinguish injection from user action:
- Immediate containment action:

**Phase 2: Investigation**
- Evidence to collect:
- Indicators of compromise:
- Scope determination method:

**Phase 3: Remediation**
- Immediate fixes:
- Long-term fixes:
- Detection rules to add:

**Phase 4: Lessons Learned**
- Architectural changes needed:
- Policy updates:
- Training recommendations:

---

## Final Score

| Module | Points Earned | Max Points |
|--------|--------------|------------|
| Module 1 | | 20 |
| Module 2 | | 25 |
| Module 3 | | 25 |
| Module 4 | | 20 |
| Module 5 | | - |
| Module 6 | | 10 |
| **Total** | | **100** |

**Certification Level:** ☐ Practitioner (60-79) ☐ Specialist (80-94) ☐ Expert (95+)

---

## Additional Notes





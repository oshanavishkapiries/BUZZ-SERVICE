# BUZZ-SERVICE API ප්‍රධාන යතුරු වාස්තු ව්‍යවස්ථාව (API Key Architecture)

## 📋 අරුණු (Contents)
1. [ව්‍යවස්ථා ප්‍රකාශ](#ව්‍යවස්ථා-ප්‍රකාශ)
2. [API යතුරු ব්‍යවස্ථාපනය](#api-යතුරු-ব්‍යවස්ථාපනය)
3. [සත්‍යාපන ප්‍රක්‍රියා](#සත්‍යාපන-ප්‍රක්‍රියා)
4. [අධිකාර ඉක්මන් අවධි](#අධිකාර-ඉක්මන්-අවධි)
5. [ডেटाබේස් ව්‍යූහ](#ডেটাබේස්-ව්‍යූහ)
6. [ආරක්ષණ ලක්ෂණ](#ආරක්ෂණ-ලක්ෂණ)

---

## ව්‍යවස්ථා ප්‍රකාශ (Architecture Overview)

### BUZZ-SERVICE නිර්මාණ (Project Structure)
```
BUZZ-SERVICE
├── internal/
│   ├── domain/          # ව්‍යවසায়িক ක්ෂේත්‍ර ස්ථිතික
│   ├── store/           # දත්ත ගබඩා ක්‍රියාකාරිතා
│   │   ├── api_keys.go  # API යතුරු ඉතිහාසය
│   │   └── migrations/  # දත්ත ස්වයं-ස්ථාපනය
│   ├── api/             # HTTP endpoints
│   │   ├── middleware.go    # සත්‍යාපන පද්ධතිය
│   │   └── routes.go    # මාර්ගීකරණ
│   └── ...
└── ...
```

API යතුරු සිස්තමය BUZZ-SERVICE සේවාවේ සියලු පිවිසුම් පිළිබඳ දත්ත ප්‍රවේශ පාලනය (access control) කරන ප්‍රධාන සম්පූර්ණකරණ:

1. **සත්‍යාපනය (Authentication)** - API යතුරු හඳුනා ගැනීම
2. **අධිකරණය (Authorization)** - අවසර පරීක්ෂා කිරීම
3. **අනුපාত සීමා කිරීම (Rate Limiting)** - ප්‍රවේශ සংඛ්‍යා පාලනය
4. **පිරික්සුම (Monitoring)** - ප්‍රවේශ වාර ටිපි සිටුවම

---

## API යතුරු ব්‍යවස්ථාපනය (API Key Management)

### ② API යතුරු ගබඩාව (API Keys Storage)

**ටේබිලය**: `api_keys`

```sql
api_keys (
    id UUID PRIMARY KEY,
    name VARCHAR(255),           -- යතුරු නම
    description TEXT,            -- විස්තරණ
    key_hash VARCHAR(255),       -- SHA256 හ්‍රාස (සුරක්ෂිතව ගබඩා කරන ලදි)
    key_prefix VARCHAR(20),      -- පළමු 8 අක්ෂර (පිටපතින් නොගබඩා)
    environment VARCHAR(20),     -- උත්පාදන/සිරුරු/සංවර්ධන/පරීක්ෂණ
    scopes TEXT[],              -- අධිකාර කාණ්ඩ
    rate_limit_per_minute INT,  -- මිනිත්තුවට අවසර සීමාව
    rate_limit_per_hour INT,    -- පැයට අවසර සීමාව
    rate_limit_per_day INT,     -- දිනට අවසර සීමාව
    last_used_at TIMESTAMP,     -- අවසාන භාවිතා වන්නේ
    usage_count INT,            -- සම්පූර්ණ භාවිතා ගණන
    allowed_ips TEXT[],         -- IP ලැයිස්තු (විකල්ප)
    is_active BOOLEAN,          -- සක්‍රිය පරිමාණ
    expires_at TIMESTAMP,       -- අවසර කිරීම් කාලය
    created_at TIMESTAMP,       -- සෑදුණු දිනුම
    updated_at TIMESTAMP        -- යාවත්කාලීන දිනුම
)
```

### ② API යතුරු සිටුවම (API Key Components)

API යතුරු තිබෙන්නේ දෙවර්ගයි:

#### 1️⃣ **සම්පූර්ණ යතුරු** (Full API Key)
```
buzz_test_key_123
↓
← නිර්මිතයි අවසර ලබා ගැනීම සඳහා
← UTF-8 ඉංග්‍රීසි අක්ෂර, ඉලක්කම්, අඩු ඉරි සම්බන්ධ
```

#### 2️⃣ **හ්‍රාස** (Key Hash)
```
SHA256("buzz_test_key_123") = 
be1821aec251a0c3191119b5d182f931442ba3dc2be5372234d35ebe9b550224
↓
← දත්ත ගබඩාවේ ගබඩා කරන ලදි (සුරක්ෂිතව)
← සුවිශේෂ හැඳුනුම වලින්, විවිධ යතුරු නොතිබිණි
```

#### 3️⃣ **පූර්වසර** (Key Prefix)
```
buzz_test_key_123 → buzz_tes
↓
← පිටපතින් නොගබඩා (ගබඩාව රතු කිරීම තුළ)
← API වැරදි පණිවුඩයි හඳුනා ගැනීම සඳහා
```

### ② API යතුරු සිට උදාහරණ (API Key Examples)

ශාඛැටපතින් ගබඩා කරන ලදි **999_seed_data.sql**:

| යතුරු |  වැඩ | පරිසරය | අධිකාර | අනුපාත සීමාව |
|-------|---------|---------|---------|----------|
| `buzz_test_key_123` | සංවර්ධනය සඳහා සම්පූර්ණ ප්‍රවේශ | `test` | සියලු සු | 1000/min |
| `buzz_live_prod_key` | උත්පාදනයි සම්පූර්ණ ප්‍රවේශ | `production` | `*` | 100/min |
| `buzz_monitor_read` | සිතිවිලි සිඳුවෙයින් | `production` | කිරීම් පිටපත | 500/min |
| `buzz_sender_limited` | සීමිත - දැනුම්දීම් යැවීම පමණක් | `production` | යැවීම/කිරීම් | 2000/min |

---

## සත්‍යාපන ප්‍රක්‍රියා (Authentication Flow)

### ② සත්‍යාපන ශ්‍රෙණිගත (Authentication Steps)

```
┌─────────────────────────────────────────────────────────────────┐
│  1. ගිණුම් ශීර්ෂ කිරීම (Extract API Key from Authorization Header)  │
│     Authorization: Bearer buzz_test_key_123                     │
│                                                                  │
│  2. ප්‍රමාණ පරීක්ෂා කිරීම (Validate Key Format)                 │
│     buzz_ ප්‍රතිසර යෙ ශුරු විය යුතුයි                     │
│                                                                  │
│  3. යතුරු හ්‍රාස කිරීම (Hash the API Key)                    │
│     SHA256(buzz_test_key_123) = be1821aec...                    │
│                                                                  │
│  4. දත්ත ගබඩාවෙන් එය සොයා ගැනීම (Lookup in Database)           │
│     SELECT * FROM api_keys WHERE key_hash = ?                   │
│                                                                  │
│  5. සක්‍රිය සහ එසැත අවසර පරීක්ෂා කිරීම (Check Status)           │
│     ✓ is_active = true                                          │
│     ✓ expires_at > NOW()                                        │
│     ✓ deleted_at IS NULL                                        │
│                                                                  │
│  6. ශ්‍රෙණිගතයි (Store API Key Info in Context)              │
│     c.Locals("api_key", key)                                    │
│     c.Locals("scopes", key.Scopes)                              │
│                                                                  │
│  7. භාවිතා සිටුවම (Update Usage Statistics - Async)           │
│     last_used_at = NOW()                                        │
│     usage_count++                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### ② සත්‍යාපන පද්ධතිය (AuthMiddleware)

**ගිණුම් පිස්සු**: `internal/api/middleware.go`

```go
// AuthMiddleware සිතිවිලි API යතුරු සත්‍යාපනය කරයි
func AuthMiddleware(store APIKeyStore) fiber.Handler {
    return func(c *fiber.Ctx) error {
        // පිස්සු ශීර්ෂ කිරීම
        auth := c.Get("Authorization")
        if auth == "" {
            return c.Status(401).JSON(fiber.Map{
                "error": "missing authorization header",
            })
        }
        
        // "Bearer buzz_xxx..." ඇසෙයි
        parts := strings.SplitN(auth, " ", 2)
        if len(parts) != 2 || parts[0] != "Bearer" {
            return c.Status(401).JSON(fiber.Map{
                "error": "invalid authorization format",
            })
        }
        
        apiKey := parts[1]
        
        // buzz_ ප්‍රතිසර පරීක්ෂා කිරීම
        if !strings.HasPrefix(apiKey, "buzz_") {
            return c.Status(401).JSON(fiber.Map{
                "error": "invalid api key format",
            })
        }
        
        // SHA256 හ්‍රාස
        keyHash := hashAPIKey(apiKey)
        
        // දත්ත ගබඩාවෙන් සොයා ගැනීම
        key, err := store.GetAPIKeyByKeyHash(c.Context(), keyHash)
        if err != nil {
            return c.Status(401).JSON(fiber.Map{
                "error": "invalid api key",
            })
        }
        
        // සක්‍රිය එසැත පරීක්ෂා කිරීම
        if !key.IsActive {
            return c.Status(401).JSON(fiber.Map{
                "error": "api key is inactive",
            })
        }
        
        // අවසර කිරීම් පරීක්ෂා කිරීම
        if key.ExpiresAt != nil && key.ExpiresAt.Before(time.Now()) {
            return c.Status(401).JSON(fiber.Map{
                "error": "api key has expired",
            })
        }
        
        // ශ්‍රෙණිගතයි
        c.Locals("api_key", key)
        c.Locals("scopes", key.Scopes)
        
        // භාවිතා සිටුවම (අසම්පූර්ණ)
        go func() {
            ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
            defer cancel()
            _ = store.UpdateAPIKeyUsage(ctx, key.ID)
        }()
        
        return c.Next()
    }
}
```

---

## අධිකාර ඉක්මන් අවධි (Authorization Scopes)

### ② අධිකරණ පද්ධතිය (Scope-based Authorization)

API යතුරු අධිකරණ පිළිබඳ ගරු සිටුවනු ලබයි, තිබෙන්නේ ඉතිරි පිරිසි:

#### 🔐 **සුවිශේෂ අධිකරණ** (Granular Permissions)

```
notification:send      - විද්‍යුත් දැනුම්දීම් යැවීම
notification:read      - විද්‍යුත් දැනුම්දීම් කිරීම් ඉතිහාසය
notification:update    - විද්‍යුත් දැනුම්දීම් තත්පරාවුල විස්තර අදාල කිරීම
notification:delete    - විද්‍යුත් දැනුම්දීම් මකා දැමීම (සම්පූර්ණ මකා දැමීම)

template:read          - නිරූපණ කිරීම් කිරීම
template:write         - නිරූපණ කිරීම් නිර්මාණය/විස්තර අදාල කිරීම

batch:write            - බහු කර්මසිද්ධි නිර්මාණය සහ ბඳවා දැමීම
batch:read             - බහු කර්මසිද්ධි විස්තර සහ ප්‍රගතිය කිරීම
batch:update           - බහු කර්මසිද්ධි තත්පරාවුල විස්තර අදාල කිරීම

datasource:read        - තොරතුරු ගබඩා සැකැස්ම කිරීම
datasource:write       - තොරතුරු ගබඩා නිර්මාණය/විස්තර අදාල කිරීම

monitoring:read        - පේළිබඳ සිතිවිලි සහ සිතිවිලි ඉතිහාසය කිරීම
queue:inspect          - පේළිබඳ අවස්ථා සහ තත්පරාවුල කිරීම

device:register        - හෝඩිසි සටිනු දිගහැරීම
device:list            - හෝඩිසි ලැයිස්තුව සිටිමින් ගිණුම්
device:delete          - හෝඩිසි සටිනු මකා දැමීම

inbox:read             - පරිශීලක ඉතිහාසය පිටුවල කිරීම
inbox:update           - පරිශීලක ඉතිහාසය සලකුණු කිරීම (කිරීම/සංරක්ෂිත)

*                      - සියලු සිතිවිලි අවසර
```

#### 🔑 **පිටපතින් පිරිසි** (Scope Groups by Key)

| අධිකරණ | පිරිසි | ඉතිරි |
|---------|---------|---------|
| `buzz_test_key_123` | සියලු ස්ථිතිය | සංවර්ධනය සහ පරීක්ෂණ |
| `buzz_live_prod_key` | `*` (සම්පූර්ණ) | උත්පාදනයි සම්පූර්ණ ප්‍රවේශ |
| `buzz_monitor_read` | `:read` පිරිසි | සිතිවිලි සිඳුවෙයින් |
| `buzz_sender_limited` | send, read, register | ඊටත් වඩා සීමිත |

### ② RequireScope පද්ධතිය (Scope Validation)

**ගිණුම් පිස්සු**: `internal/api/middleware.go`

```go
// RequireScope අධිකරණ අවසර පරීක්ෂා කරයි
func RequireScope(scope string) fiber.Handler {
    return func(c *fiber.Ctx) error {
        // ශ්‍රෙණිගතයි අධිකරණ ඉක්මනින් ගිණුම්
        scopes, ok := c.Locals("scopes").([]string)
        if !ok {
            return c.Status(403).JSON(fiber.Map{
                "error": "no scopes found in context",
            })
        }
        
        // අවසර කෙටි ඉතිහාසයි
        for _, s := range scopes {
            if s == scope || s == "*" {
                // "*" නම් සියලු අවසර ඇත
                return c.Next()
            }
        }
        
        return c.Status(403).JSON(fiber.Map{
            "error":          "insufficient permissions",
            "required_scope": scope,
        })
    }
}
```

#### 📍 **ඉතිරි ගිණුම්** (Usage in Routes)

```go
// පරිශීලක দැනුම්දීම් යැවීමේ endpoint සඳහා
router.Post("/notifications/send", 
    AuthMiddleware(store),                // සත්‍යාපනය
    RequireScope("notification:send"),    // අධිකරණය
    NotificationSendHandler)              // ඉක්මඳුම

// සිතිවිලි කිරීමේ endpoint සඳහා
router.Get("/monitoring/stats",
    AuthMiddleware(store),                // සත්‍යාපනය
    RequireScope("monitoring:read"),      // අධිකරණය
    MonitoringHandler)                    // ඉක්මඳුම
```

---

## ডেটাබේස් ව්‍යූහ (Database Schema)

### ② API Keys ටේබිල එකෙන් නීතිමත් (Table Definition)

```sql
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- යතුරු විස්තරණ
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- හ්‍රාස යතුරු (SHA256)
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    
    -- පළමු 8 අක්ෂර (පිටපතින් නොගබඩා)
    key_prefix VARCHAR(20) NOT NULL,
    
    -- පරිසරය (production/staging/development/test)
    environment VARCHAR(20) NOT NULL DEFAULT 'production'
        CHECK (environment IN ('production', 'staging', 'development', 'test')),
    
    -- අධිකරණ කාණ්ඩ
    scopes TEXT[] NOT NULL DEFAULT '{}',
    
    -- අනුපාත සීමා කිරීම
    rate_limit_per_minute INTEGER DEFAULT 100,
    rate_limit_per_hour INTEGER DEFAULT 1000,
    rate_limit_per_day INTEGER DEFAULT 10000,
    
    -- භාවිතා ටිපි සිටුවම
    last_used_at TIMESTAMPTZ,
    usage_count INTEGER NOT NULL DEFAULT 0,
    
    -- IP ලැයිස්තු (විකල්ප)
    allowed_ips TEXT[],
    
    -- තත්පරාවුල
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- අවසර කිරීම් කාලය
    expires_at TIMESTAMPTZ,
    
    -- අමතර තොරතුරු
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    
    -- මෘදු මකා දැමීම
    deleted_at TIMESTAMPTZ
);

-- සිරිසිටුම
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash) 
    WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix) 
    WHERE deleted_at IS NULL;
CREATE INDEX idx_api_keys_environment ON api_keys(environment) 
    WHERE deleted_at IS NULL;
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active) 
    WHERE deleted_at IS NULL;
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at) 
    WHERE expires_at IS NOT NULL;
CREATE INDEX idx_api_keys_created_at ON api_keys(created_at DESC);
```

### ② නිරූපණ කිරීම් (Indexes Explanation)

| සිරිසිටුම | විස්තරණ | ප්‍රයෝජනය |
|---------|-----------|---------|
| `idx_api_keys_key_hash` | හ්‍රාස, සක්‍රිය | සත්‍යාපනයේ දෙගුණ සෙවීම |
| `idx_api_keys_environment` | පරිසරය | පරිසරය විනිසෙස කිරීම |
| `idx_api_keys_is_active` | සක්‍රිය තත්පරාවුල | සක්‍රිය යතුරු ඉක්මනින |
| `idx_api_keys_created_at` | නිර්මාණ දිනුම | අවසර-අවසරයන්ගේ වර්ගීකරණ |

---

## ආරක්ෂණ ලක්ෂණ (Security Features)

### 🔒 **මුල්‍ය ආරක්ෂණ** (Key Storage Security)

#### 1️⃣ **SHA256 හ්‍රාස** (Hashing)
- සම්පූර්ණ API යතුරු කවදාත් දත්ත ගබඩාවේ ගබඩා නොකරයි
- පිටපතින් SHA256 හ්‍රාස ගබඩා කරනු ලබයි
- සිතිවිලි පිටපතුන් වලින්, නැවතින් සෑදිය නොහැකි

```
API Key: buzz_test_key_123
SHA256:  be1821aec251a0c3191119b5d182f931442ba3dc2be5372234d35ebe9b550224
                                    ↑
                            ගබඩා කරන ලදි
```

#### 2️⃣ **පුරවල** (Key Prefix)
- පිටපතින්, නොගබඩා වන පළමු 8 අක්ෂරය (buzz_tes)
- වැරදි පණිවුඩයි හඳුනා ගැනීම සඳහා ගනුයෙන් භාවිත

#### 3️⃣ **JSON තොරතුරු** (JSON Web Storage)
- API යතුරු කවදාත් JSON ප්‍රතිචාරයි නිරුපිතයි
- KeyHash ක්ෂේත්‍රයි `json:"-"` සඳහා
- පිටපතින් නිරුපිතයි නොකරයි

### 🔐 **වසර ආරක්ෂණ** (Verification Security)

#### 1️⃣ **සක්‍රිය අවස්ථා** (Active Status)
```go
if !key.IsActive {
    return c.Status(401).JSON(fiber.Map{
        "error": "api key is inactive",
    })
}
```

#### 2️⃣ **අවසර කිරීම්** (Expiration)
```go
if key.ExpiresAt != nil && key.ExpiresAt.Before(time.Now()) {
    return c.Status(401).JSON(fiber.Map{
        "error": "api key has expired",
    })
}
```

#### 3️⃣ **මෘදු මකා දැමීම** (Soft Delete)
```sql
WHERE is_active = true AND deleted_at IS NULL
```
- කිසිවක් මකා දැමි නොවේ (සඳහා වටහා ගැනීම)
- `deleted_at` ඇසීමින් ඉතිහාසයි ගබඩා

### 📊 **අනුපාත සීමා කිරීම** (Rate Limiting)

#### 1️⃣ **සීමා ක්ෂේත්‍ර** (Rate Limit Fields)
```go
type APIKey struct {
    RateLimitPerMinute *int  // මිනිත්තුවට අවසර
    RateLimitPerHour   *int  // පැයට අවසර
    RateLimitPerDay    *int  // දිනට අවසර
}
```

#### 2️⃣ **උදාහරණ** (Examples)
| යතුරු | මිනිත්තුවට | පැයට | දිනට |
|-------|------------|--------|--------|
| `buzz_test_key_123` | 1000 | 10000 | 100000 |
| `buzz_live_prod_key` | 100 | 1000 | 10000 |
| `buzz_monitor_read` | 500 | 5000 | 50000 |

### 🌐 **IP ලැයිස්තු** (IP Whitelisting)

```go
type APIKey struct {
    AllowedIPs []string  // ["192.168.1.1", "10.0.0.0/24"]
}
```

- විකල්ප IP ලැයිස්තු සඳහා
- කිසිවක් සඳහන් නොකරනු ලබයි = සියලු IP ගෙන්
- ඉඩකඩ ඉක්මනින්: `192.168.1.1` හෝ CIDR `10.0.0.0/24`

### 📱 **භාවිතා ටිපි සිටුවම** (Usage Tracking)

```go
type APIKey struct {
    LastUsedAt *time.Time  // අවසාන භාවිතා වන්නේ
    UsageCount int         // සම්පූර්ණ භාවිතා
}
```

- අසම්පූර්ණ ටිපි සිටුවම භාවිතා කරන ලබයි
- ඉතිරි ඕසි සිතිවිලි අවස්ථා අනුසරණ කිරීම

---

## ඉතිරි සිතිවිලි (Implementation Details)

### ② Go කෝඩ් ව්‍යූහ (Go Code Structure)

**ඉතිරි ගිණුම්** (`internal/store/api_keys.go`):

```go
type APIKeyRepository struct {
    db *sql.DB
}

// API යතුරු නිර්මාණය
func (r *APIKeyRepository) Create(ctx context.Context, apiKey *domain.APIKey) error

// ID වලින් ඉක්මනින් ගිණුම්
func (r *APIKeyRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.APIKey, error)

// හ්‍රාස වලින් ඉක්මනින් ගිණුම් (සත්‍යාපනයි භාවිත)
func (r *APIKeyRepository) GetByKeyHash(ctx context.Context, keyHash string) (*domain.APIKey, error)

// API යතුරු විස්තර අදාල කිරීම
func (r *APIKeyRepository) Update(ctx context.Context, apiKey *domain.APIKey) error

// භාවිතා ටිපි සිටුවම
func (r *APIKeyRepository) UpdateUsage(ctx context.Context, id uuid.UUID) error

// ඉතිරි සිටුවම්
func (r *APIKeyRepository) List(ctx context.Context, filters map[string]interface{}, limit, offset int) ([]*domain.APIKey, error)

// මෘදු මකා දැමීම
func (r *APIKeyRepository) Delete(ctx context.Context, id uuid.UUID) error
```

### ② පද්ධතිමය ධර්ම (Flow Diagrams)

#### ① සත්‍යාපන ධර්ම (Authentication Flow)
```
┌─────────────┐
│  HTTP ඉතිරි  │
└──────┬──────┘
       │ Authorization: Bearer buzz_xxx...
       ↓
┌──────────────────┐
│ AuthMiddleware   │
├──────────────────┤
│ 1. ශීර්ෂ කිරීම  │
│ 2. ප්‍රමාණ පරීක්ෂා │
│ 3. හ්‍රාස කිරීම    │
│ 4. දත්ත ගබඩා    │
│ 5. තත්පරාවුල ✓  │
│ 6. ශ්‍රෙණිගතයි   │
└──────┬───────────┘
       │ Valid ✓
       ↓
┌──────────────────┐
│ RequireScope     │
├──────────────────┤
│ අධිකරණ පරීක්ෂා │
└──────┬───────────┘
       │ Authorized ✓
       ↓
┌──────────────────┐
│ Route Handler    │
└──────────────────┘
```

#### ② සත්‍යාපනය අසාර (Authentication Failed)
```
┌─────────────┐
│  HTTP ඉතිරි  │
└──────┬──────┘
       │ Authorization: Bearer invalid_key
       ↓
┌──────────────────┐
│ AuthMiddleware   │
├──────────────────┤
│ 1. ශීර්ෂ කිරීම  │
│ 2. ප්‍රමාණ පරීක්ෂා ✗
│    (buzz_ නොගිණුම්) │
└──────┬───────────┘
       │ Invalid
       ↓
┌────────────────────┐
│ 401 Unauthorized   │
│ "invalid api key"  │
└────────────────────┘
```

---

## 📚 ඉතිරි සිතිවිලි (Summary)

### 🎯 **ප්‍රධාන ලක්ෂණ**

| ලක්ෂණ | විස්තරණ |
|-------|-----------|
| **සුරක්ෂිත ගබඩාව** | SHA256 හ්‍රාස, පිටපතින් නොගබඩා |
| **සත්‍යාපනය** | Bearer ශිරස්තලයි, ගබඩා හ්‍රාස ගිණුම් |
| **අධිකරණය** | Scope-based permissions |
| **අනුපාත සීමා** | මිනිත්තුවට/පැයට/දිනට සීමාව |
| **IP ලැයිස්තු** | විකල්ප ලැයිස්තු |
| **ඉතිහාසයි** | last_used_at, usage_count ටිපි |
| **අවසර කිරීම්** | Optional expiration dates |
| **මෘදු ඉවත්කිරීම** | පරිශීලන ඉතිහාසයි ඉතිරි |

### 🔑 **API යතුරු උපයෝගී ගිණුම්**

1. **සංවර්ධනය** (Development): `buzz_test_key_123` සඳහා සම්පූර්ණ ප්‍රවේශ
2. **උත්පාදනය** (Production): `buzz_live_prod_key` සඳහා සීමිත පිරිසි
3. **සිතිවිලි** (Monitoring): `buzz_monitor_read` මඩුවන් කිරීම් පිටපත
4. **යැවීම** (Sending): `buzz_sender_limited` පිටපත යැවීම පමණක්

---

## 📖 වැඩිදුර සිතිවිලි (Additional Resources)

- **ගිණුම් ගිණුම්**: `internal/api/middleware.go`
- **ඉතිරි ගිණුම්**: `internal/store/api_keys.go`
- **නිරූපණ**: `internal/domain/models.go`
- **ඉතිරි ගිණුම්**: `internal/store/migrations/006_api_keys.sql`
- **ඉතිරි දත්ත**: `internal/store/migrations/999_seed_data.sql`

---

**ලිවීම්**: 2026-05-06 | **ගිණුම් පිස්සු**: BUZZ-SERVICE API Key Architecture

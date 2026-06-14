#!/usr/bin/env bash
# ============================================================================
# seed-demo-data.sh — populate Smart Quiz Hub with demo data via the REST API.
#
# Creates 5 SMEs, then 24 questions covering ALL lifecycle states
# (DRAFT, READY_FOR_REVIEW, UNDER_REVIEW, APPROVED, REJECTED, MODIFICATION_REQUESTED),
# with a mix of single- and multiple-correct options across stacks & difficulties,
# authored/reviewed by different SMEs — then backdates timestamps so the
# date-range analytics, weekly trend and SME turnaround features are testable.
#
# Usage:
#   bash tests/seed-demo-data.sh
#
# Override via env vars (defaults shown):
#   API_BASE=http://localhost:8080/api
#   ADMIN_ENTERPRISE_ID=admin.user   ADMIN_PASSWORD=Admin@123
#   SME_PASSWORD=Sme@12345
#   BACKDATE=1            # 0 to skip the psql date-spreading step
#   DB_USER=postgres  DB_NAME=smart_quiz_hub
# ============================================================================
set -uo pipefail

API="${API_BASE:-http://localhost:8080/api}"
ADMIN_ID="${ADMIN_ENTERPRISE_ID:-admin.user}"
ADMIN_PW="${ADMIN_PASSWORD:-Admin@123}"
SME_PW="${SME_PASSWORD:-Sme@12345}"
BACKDATE="${BACKDATE:-1}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-smart_quiz_hub}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

c_say(){ printf '\033[36m• %s\033[0m\n' "$*"; }
c_ok(){  printf '\033[32m  ✓ %s\033[0m\n' "$*"; }
c_warn(){ printf '\033[33m  ! %s\033[0m\n' "$*"; }
die(){   printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# --- tiny JSON helpers (python3, no jq dependency) --------------------------
token_of(){ python3 -c "import sys,json
try: print(json.load(sys.stdin)['data']['token'])
except Exception: pass"; }
id_of(){ python3 -c "import sys,json
try: print(json.load(sys.stdin)['data']['id'])
except Exception: pass"; }

login(){ # enterpriseId password -> token
  curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"enterpriseId\":\"$1\",\"password\":\"$2\"}" | token_of
}

# --- preflight --------------------------------------------------------------
[ "$(curl -s -o /dev/null -w '%{http_code}' "$API/actuator/health")" = "200" ] \
  || die "API not reachable at $API (is the stack running?)"

c_say "Logging in as admin ($ADMIN_ID)…"
ADMIN_TOKEN="$(login "$ADMIN_ID" "$ADMIN_PW")"
[ -n "$ADMIN_TOKEN" ] || die "Admin login failed — set ADMIN_PASSWORD correctly."
c_ok "admin authenticated"

# --- 1. create SMEs ---------------------------------------------------------
# enterpriseId ~ fullName ~ email ~ stackCSV
SMES=(
  "sme.aarav~Aarav Sharma~aarav.sharma@accenture.com~2,3"
  "sme.diya~Diya Patel~diya.patel@accenture.com~4,5"
  "sme.kabir~Kabir Singh~kabir.singh@accenture.com~6,1"
  "sme.isha~Isha Reddy~isha.reddy@accenture.com~2,4,6"
  "sme.rohan~Rohan Mehta~rohan.mehta@accenture.com~3,5"
)
SME_IDS=()  # enterpriseId list, index-aligned
declare -A SME_TOKEN

c_say "Creating ${#SMES[@]} SMEs…"
for row in "${SMES[@]}"; do
  IFS='~' read -r eid name email stacks <<< "$row"
  stackJson="[$stacks]"
  payload=$(EID="$eid" NAME="$name" EMAIL="$email" PW="$SME_PW" ST="$stackJson" python3 -c "import os,json;print(json.dumps({'enterpriseId':os.environ['EID'],'fullName':os.environ['NAME'],'email':os.environ['EMAIL'],'password':os.environ['PW'],'role':'SME','stackIds':json.loads(os.environ['ST'])}))")
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/admin/users" \
    -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$payload")
  case "$code" in
    201|200) c_ok "$name created" ;;
    409)     c_warn "$name already exists — reusing" ;;
    *)       c_warn "$name create returned HTTP $code" ;;
  esac
  SME_IDS+=("$eid")
  SME_TOKEN["$eid"]="$(login "$eid" "$SME_PW")"
  [ -n "${SME_TOKEN[$eid]}" ] || c_warn "could not log in as $eid (questions for them will be skipped)"
done

# --- 2. resolve a topic id per stack ----------------------------------------
declare -A TOPIC_OF
topic_for(){ # stackId -> first topic id (cached)
  local s="$1"
  if [ -z "${TOPIC_OF[$s]:-}" ]; then
    TOPIC_OF[$s]="$(curl -s "$API/stacks/$s/topics" -H "Authorization: Bearer $ADMIN_TOKEN" \
      | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print(d[0]['id'] if d else '')")"
  fi
  printf '%s' "${TOPIC_OF[$s]}"
}

# --- 3. question bank -------------------------------------------------------
# STATE ~ stackId ~ difficulty ~ correctCSV(0-based) ~ stem ~ opt1|opt2|opt3|opt4[|opt5]
BANK=(
  # ---- DRAFT (4) ----
  "DRAFT~2~EASY~1~Which single annotation enables auto-configuration, component scanning and Java config together?~@EnableAutoConfiguration|@SpringBootApplication|@ComponentScan|@Configuration"
  "DRAFT~6~MEDIUM~0,1,3~Which of the following are checked exceptions in Java?~IOException|SQLException|NullPointerException|ClassNotFoundException"
  "DRAFT~4~EASY~2~Which HTTP method is idempotent and fully replaces the target resource?~POST|PATCH|PUT|CONNECT"
  "DRAFT~5~MEDIUM~1~In JPA, which annotation marks the primary-key field of an entity?~@Column|@Id|@Entity|@Table"
  # ---- READY_FOR_REVIEW (4) ----
  "READY~3~MEDIUM~2~Which Spring bean scope creates a brand-new instance on every injection request?~singleton|session|prototype|application"
  "READY~6~HARD~0,2~Which statements about the Java String class are correct?~Strings are immutable|'==' compares String content|String literals live in an interned pool|StringBuilder is thread-safe"
  "READY~1~MEDIUM~0~In Spring Cloud, which component provides client-side service discovery?~Eureka|Zuul|Config Server|Sleuth"
  "READY~4~EASY~3~Which annotation binds a method argument to a URI template variable?~@RequestParam|@RequestBody|@RequestHeader|@PathVariable"
  # ---- UNDER_REVIEW (4) ----
  "UNDER~2~MEDIUM~1~Where does Spring Boot load application configuration from by default?~only from /config|src/main/resources/application.yml or .properties|the system temp directory|the OS user home folder"
  "UNDER~5~HARD~1,3~Which statements about JPA association loading are true?~EAGER defers loading|LAZY defers loading until first access|FetchType has exactly one value|@OneToMany is LAZY by default"
  "UNDER~6~EASY~2~What is the width of a Java 'int' primitive?~8 bits|16 bits|32 bits|64 bits"
  "UNDER~3~MEDIUM~0,1~Which are valid ways to declare a Spring bean?~@Component on a class|@Bean on a method in a @Configuration class|@Autowired on a field|implementing java.io.Serializable"
  # ---- APPROVED (4) ----
  "APPROVED~4~MEDIUM~1~Which annotation is shorthand for @Controller plus @ResponseBody?~@Service|@RestController|@RequestMapping|@Repository"
  "APPROVED~6~HARD~0,3~Which map implementations permit a single null key?~HashMap|Hashtable|TreeMap with natural ordering|LinkedHashMap"
  "APPROVED~2~EASY~2~Which file declares Maven dependencies for a Spring Boot project?~build.gradle|settings.xml|pom.xml|application.yml"
  "APPROVED~5~MEDIUM~1~Which Spring Data interface adds pagination and sorting on top of CRUD?~CrudRepository|PagingAndSortingRepository|Repository|JpaSpecificationExecutor"
  # ---- REJECTED (4) ----
  "REJECTED~1~MEDIUM~2~What does a Spring Cloud Config Server centralize for a microservice fleet?~service discovery|client load balancing|externalized configuration|circuit breaking"
  "REJECTED~6~EASY~0~Which Java keyword prevents a class from being subclassed?~final|static|abstract|transient"
  "REJECTED~3~HARD~1,2~Which statements about Spring dependency injection are true?~Field injection is preferred over constructor injection|Constructor injection enables immutable beans|@Autowired can resolve a dependency by type|Every bean must implement an interface"
  "REJECTED~4~MEDIUM~3~Which HTTP status code signals that a resource was successfully created?~200 OK|204 No Content|400 Bad Request|201 Created"
  # ---- MODIFICATION_REQUESTED (4) ----
  "MOD~2~MEDIUM~1~Which Spring Boot module exposes production health and metrics endpoints?~DevTools|Actuator|Initializr|AOP"
  "MOD~5~HARD~0,2~Which annotations relate to JPA mapping or transactions?~@Transactional|@RestController|@Entity|@GetMapping"
  "MOD~6~EASY~1~Which Java 8 feature enables functional-style pipelines over collections?~Generics|Streams|Annotations|Reflection"
  "MOD~4~MEDIUM~0,3~Which of these are valid Spring MVC request-mapping annotations?~@GetMapping|@QueryMapping|@TableMapping|@PostMapping"
)

state_name(){ case "$1" in
  DRAFT) echo DRAFT;; READY) echo READY_FOR_REVIEW;; UNDER) echo UNDER_REVIEW;;
  APPROVED) echo APPROVED;; REJECTED) echo REJECTED;; MOD) echo MODIFICATION_REQUESTED;; esac; }

# --- 4. create questions + drive lifecycle ----------------------------------
c_say "Creating ${#BANK[@]} questions across all states…"
n_sme=${#SME_IDS[@]}
i=0
declare -A COUNT
for row in "${BANK[@]}"; do
  IFS='~' read -r state stack diff correct stem optsField <<< "$row"
  creatorEid="${SME_IDS[$(( i % n_sme ))]}"
  reviewerEid="${SME_IDS[$(( (i + 1) % n_sme ))]}"
  ctoken="${SME_TOKEN[$creatorEid]}"
  i=$((i+1))
  [ -n "$ctoken" ] || { c_warn "skip (no creator token): $stem"; continue; }

  topic="$(topic_for "$stack")"
  [ -n "$topic" ] || { c_warn "skip (no topic for stack $stack)"; continue; }

  payload=$(STEM="$stem" OPTS="$optsField" CORRECT="$correct" DIFF="$diff" STACK="$stack" TOPIC="$topic" python3 -c "import os,json
opts=os.environ['OPTS'].split('|')
print(json.dumps({'questionStem':os.environ['STEM'],'options':opts,'correctOptionIndices':[int(x) for x in os.environ['CORRECT'].split(',')],'difficulty':os.environ['DIFF'],'stackId':int(os.environ['STACK']),'topicId':int(os.environ['TOPIC'])}))")

  qid=$(curl -s -X POST "$API/questions" -H "Authorization: Bearer $ctoken" \
        -H 'Content-Type: application/json' -d "$payload" | id_of)
  [ -n "$qid" ] || { c_warn "create failed: $stem"; continue; }

  target="$(state_name "$state")"
  [ "$state" = "DRAFT" ] && { COUNT[$target]=$(( ${COUNT[$target]:-0} + 1 )); continue; }

  # submit → READY_FOR_REVIEW
  curl -s -o /dev/null -X POST "$API/questions/$qid/submit" -H "Authorization: Bearer $ctoken"
  if [ "$state" = "READY" ]; then COUNT[$target]=$(( ${COUNT[$target]:-0} + 1 )); continue; fi

  # admin assigns reviewer → UNDER_REVIEW
  rid=$(curl -s "$API/admin/users?role=SME" -H "Authorization: Bearer $ADMIN_TOKEN" \
        | RE="$reviewerEid" python3 -c "import os,sys,json;d=json.load(sys.stdin)['data'];print(next((u['id'] for u in d if u['enterpriseId']==os.environ['RE']),''))")
  curl -s -o /dev/null -X POST "$API/reviews/questions/$qid/assign" -H "Authorization: Bearer $ADMIN_TOKEN" \
       -H 'Content-Type: application/json' -d "{\"reviewerId\":$rid}"
  if [ "$state" = "UNDER" ]; then COUNT[$target]=$(( ${COUNT[$target]:-0} + 1 )); continue; fi

  # reviewer decides
  rtoken="${SME_TOKEN[$reviewerEid]}"
  case "$state" in
    APPROVED) body='{"decision":"APPROVED"}' ;;
    REJECTED) body='{"decision":"REJECTED","comments":"Option wording is ambiguous and one distractor is incorrect — rejecting."}' ;;
    MOD)      body='{"decision":"MODIFICATION_REQUESTED","comments":"Please clarify the stem and fix option C before resubmitting."}' ;;
  esac
  curl -s -o /dev/null -X POST "$API/reviews/questions/$qid/decision" -H "Authorization: Bearer $rtoken" \
       -H 'Content-Type: application/json' -d "$body"
  COUNT[$target]=$(( ${COUNT[$target]:-0} + 1 ))
done

for s in DRAFT READY_FOR_REVIEW UNDER_REVIEW APPROVED REJECTED MODIFICATION_REQUESTED; do
  c_ok "$s: ${COUNT[$s]:-0}"
done

# --- 5. backdate timestamps (psql) ------------------------------------------
if [ "$BACKDATE" = "1" ]; then
  c_say "Backdating timestamps across the last ~12 weeks (psql)…"
  if docker compose -f "$ROOT/docker-compose.yml" exec -T postgres \
       psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f - < "$ROOT/tests/backdate.sql" >/dev/null 2>&1; then
    c_ok "timestamps spread"
  else
    c_warn "could not run backdate.sql via docker (run it manually — see tests/README.md)"
  fi
fi

c_say "Done. Log in as admin to see the populated dashboards & analytics."
echo "   SMEs: ${SME_IDS[*]}  (password: $SME_PW)"

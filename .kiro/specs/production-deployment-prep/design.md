# Design Document: Production Deployment Preparation

## Overview

This design transforms the Flask backend application from a development-oriented configuration to a production-ready system. The current application uses Flask's development server with debug mode enabled, lacks structured logging, has no centralized error handling, and doesn't support environment-based configuration. This design introduces a layered architecture with clear separation between configuration management, logging infrastructure, error handling, and application monitoring.

The solution implements a configuration management layer that loads environment-specific settings, a structured JSON logging system with rotation, centralized error handling with unique error IDs, health monitoring endpoints, and graceful shutdown handling. The application will run on Gunicorn (a production WSGI server) with appropriate worker configuration.

Key design principles:
- Environment-based configuration without code changes
- Structured, parseable logging for production diagnostics
- Centralized error handling with consistent logging and user-friendly responses
- Health monitoring for operational visibility
- Secure credential management
- Graceful shutdown for zero-downtime deployments

## Architecture

### Component Overview

The architecture introduces four new core components and modifies the existing application structure:

```
┌─────────────────────────────────────────────────────────────┐
│                     Flask Application                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Error Handler Middleware                   │ │
│  │  (Intercepts exceptions, logs, returns formatted errors)│ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│  ┌────────────────────────┴──────────────────────────────┐  │
│  │                  Route Handlers                        │  │
│  │  (auth, meal, stock, milk, egg, pay, sub, health)     │  │
│  └────────────────────────────────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────┴──────────────────────────────┐  │
│  │              Database Layer (db.py)                    │  │
│  │              Service Layer (svc/)                      │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Configuration   │  │ Logger          │  │ Health Monitor  │
│ Manager         │  │ (JSON, Rotated) │  │ (Endpoints)     │
│ (config.py)     │  │ (logger.py)     │  │ (health.py)     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              Environment Variables (.env)                    │
│  FLASK_ENV, SUPABASE_URL, SUPABASE_KEY, LOG_LEVEL, etc.    │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

**Configuration Manager (config.py)**
- Loads environment variables with validation
- Provides environment-specific defaults
- Masks sensitive credentials in logs
- Validates .gitignore contains .env file
- Raises descriptive errors for missing required variables

**Logger (logger.py)**
- Configures Python logging with JSON formatter
- Implements log rotation (10MB max, 5 backups)
- Sets log levels based on environment (DEBUG for dev, INFO for prod)
- Provides structured log entries with timestamp, level, module, message
- Writes to configurable log directory

**Error Handler (error_handler.py)**
- Registers Flask error handlers for all exception types
- Generates unique error IDs for tracking
- Logs full stack traces with request context
- Returns environment-appropriate responses (generic in prod, detailed in dev)
- Includes error ID in client responses for support reference

**Health Monitor (health.py)**
- Provides basic health endpoint (GET /health) returning 200 when running
- Provides detailed health endpoint (GET /health/detailed) with:
  - Database connectivity check
  - Application version and uptime
  - HTTP 503 on failure
  - 5-second timeout

**Shutdown Handler (shutdown.py)**
- Registers signal handlers for SIGTERM and SIGINT
- Stops accepting new requests on shutdown signal
- Waits for in-flight requests (30-second timeout)
- Closes database connections cleanly
- Logs shutdown events

### Data Flow

1. **Application Startup**
   - Configuration Manager loads and validates environment variables
   - Logger initializes with environment-specific settings
   - Error Handler registers exception handlers
   - Health Monitor registers endpoints
   - Shutdown Handler registers signal handlers
   - Application starts on Gunicorn with configured workers

2. **Request Processing**
   - Request enters Flask application
   - Route handler processes request
   - If exception occurs, Error Handler intercepts
   - Error Handler logs with context and error ID
   - Error Handler returns formatted response
   - All operations logged via structured logger

3. **Health Checks**
   - Load balancer/orchestrator calls /health or /health/detailed
   - Health Monitor checks database connectivity
   - Returns status with uptime and version info

4. **Shutdown**
   - SIGTERM/SIGINT received
   - Shutdown Handler stops accepting new requests
   - Waits for in-flight requests (max 30s)
   - Closes database connections
   - Logs shutdown completion
   - Process exits

## Components and Interfaces

### Configuration Manager (config.py)

**Purpose**: Centralized configuration management with environment-based settings and validation.

**Interface**:
```python
class Config:
    """Application configuration loaded from environment variables"""
    
    # Environment
    FLASK_ENV: str  # 'development', 'staging', or 'production'
    
    # Database
    SUPABASE_URL: str
    SUPABASE_KEY: str
    
    # Authentication
    GOOGLE_CLIENT_ID: str
    
    # Logging
    LOG_LEVEL: str  # 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'
    LOG_DIR: str  # Directory for log files
    LOG_FILE: str  # Log file name
    
    # Server
    HOST: str
    PORT: int
    WORKERS: int  # Gunicorn worker count
    TIMEOUT: int  # Gunicorn timeout
    
    # Application
    SECRET_KEY: str
    
    @classmethod
    def validate(cls) -> None:
        """Validate required environment variables are present"""
        
    @classmethod
    def mask_sensitive(cls, key: str, value: str) -> str:
        """Mask sensitive credential values for logging"""
        
    @classmethod
    def check_gitignore(cls) -> None:
        """Validate .env is in .gitignore"""
```

**Environment Variables**:
- Required: `FLASK_ENV`, `SUPABASE_URL`, `SUPABASE_KEY`, `GOOGLE_CLIENT_ID`, `SECRET_KEY`
- Optional with defaults: `LOG_LEVEL`, `LOG_DIR`, `LOG_FILE`, `HOST`, `PORT`, `WORKERS`, `TIMEOUT`

**Defaults by Environment**:
- Development: `LOG_LEVEL=DEBUG`, `WORKERS=1`, `TIMEOUT=120`
- Staging: `LOG_LEVEL=INFO`, `WORKERS=2`, `TIMEOUT=60`
- Production: `LOG_LEVEL=INFO`, `WORKERS=4`, `TIMEOUT=30`

### Logger (logger.py)

**Purpose**: Structured JSON logging with rotation and environment-specific configuration.

**Interface**:
```python
class JSONFormatter(logging.Formatter):
    """Custom formatter outputting JSON log entries"""
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON with timestamp, level, module, message"""

def setup_logger(
    name: str,
    log_level: str,
    log_dir: str,
    log_file: str
) -> logging.Logger:
    """
    Configure and return a logger with JSON formatting and rotation
    
    Args:
        name: Logger name (typically __name__)
        log_level: Minimum log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_dir: Directory for log files
        log_file: Log file name
        
    Returns:
        Configured logger instance
    """

def get_logger(name: str) -> logging.Logger:
    """Get logger instance for a module"""
```

**Log Entry Format**:
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "ERROR",
  "module": "routes.auth",
  "message": "Authentication failed for user",
  "error_id": "abc123",
  "request": {
    "method": "POST",
    "path": "/api/auth/login",
    "ip": "192.168.1.1"
  },
  "exception": "ValueError: Invalid token"
}
```

**Rotation Configuration**:
- Max file size: 10MB
- Backup count: 5
- Rotation happens automatically when size exceeded

### Error Handler (error_handler.py)

**Purpose**: Centralized exception handling with consistent logging and user-friendly responses.

**Interface**:
```python
def generate_error_id() -> str:
    """Generate unique error ID for tracking"""

def log_error(
    logger: logging.Logger,
    error: Exception,
    error_id: str,
    request_context: dict
) -> None:
    """Log error with full context and stack trace"""

def format_error_response(
    error: Exception,
    error_id: str,
    include_details: bool
) -> tuple[dict, int]:
    """
    Format error response for client
    
    Args:
        error: The exception that occurred
        error_id: Unique error identifier
        include_details: Whether to include stack trace (dev only)
        
    Returns:
        Tuple of (response_dict, status_code)
    """

def register_error_handlers(app: Flask, logger: logging.Logger) -> None:
    """Register error handlers for all exception types"""
```

**Error Response Format (Production)**:
```json
{
  "error": "An internal error occurred",
  "error_id": "abc123",
  "message": "Please contact support with this error ID"
}
```

**Error Response Format (Development)**:
```json
{
  "error": "ValueError: Invalid token format",
  "error_id": "abc123",
  "traceback": "Traceback (most recent call last)...",
  "request": {
    "method": "POST",
    "path": "/api/auth/login"
  }
}
```

### Health Monitor (health.py)

**Purpose**: Provide health check endpoints for monitoring and orchestration.

**Interface**:
```python
def check_database_health() -> tuple[bool, str]:
    """
    Check database connectivity
    
    Returns:
        Tuple of (is_healthy, message)
    """

def get_uptime() -> float:
    """Get application uptime in seconds"""

def get_version() -> str:
    """Get application version from environment or package"""

def register_health_endpoints(app: Flask) -> None:
    """Register health check routes"""
```

**Endpoints**:

1. **Basic Health Check**
   - Route: `GET /health`
   - Response: `{"status": "ok"}` (200)
   - Purpose: Simple liveness check

2. **Detailed Health Check**
   - Route: `GET /health/detailed`
   - Response (healthy):
     ```json
     {
       "status": "healthy",
       "version": "1.0.0",
       "uptime_seconds": 3600,
       "checks": {
         "database": {
           "status": "healthy",
           "message": "Connected to Supabase"
         }
       }
     }
     ```
   - Response (unhealthy): Same structure with `"status": "unhealthy"` and HTTP 503
   - Timeout: 5 seconds

### Shutdown Handler (shutdown.py)

**Purpose**: Handle graceful shutdown on SIGTERM/SIGINT signals.

**Interface**:
```python
class ShutdownHandler:
    """Manages graceful application shutdown"""
    
    def __init__(self, app: Flask, logger: logging.Logger):
        self.app = app
        self.logger = logger
        self.shutdown_requested = False
        self.start_time = time.time()
        
    def register_handlers(self) -> None:
        """Register signal handlers for SIGTERM and SIGINT"""
        
    def shutdown(self, signum: int, frame) -> None:
        """
        Handle shutdown signal
        - Stop accepting new requests
        - Wait for in-flight requests (max 30s)
        - Close database connections
        - Log shutdown events
        """
        
    def close_connections(self) -> None:
        """Close database and external service connections"""
```

## Data Models

This feature primarily deals with configuration and operational data rather than domain models. The key data structures are:

### Configuration Data
```python
@dataclass
class AppConfig:
    """Application configuration"""
    flask_env: str
    supabase_url: str
    supabase_key: str
    google_client_id: str
    secret_key: str
    log_level: str
    log_dir: str
    log_file: str
    host: str
    port: int
    workers: int
    timeout: int
```

### Log Entry
```python
@dataclass
class LogEntry:
    """Structured log entry"""
    timestamp: str  # ISO 8601 format
    level: str  # DEBUG, INFO, WARNING, ERROR, CRITICAL
    module: str  # Module name
    message: str  # Log message
    error_id: Optional[str] = None
    request: Optional[dict] = None  # Request context
    exception: Optional[str] = None  # Exception details
```

### Health Check Result
```python
@dataclass
class HealthCheck:
    """Health check result"""
    status: str  # 'healthy' or 'unhealthy'
    version: str
    uptime_seconds: float
    checks: dict[str, ComponentHealth]

@dataclass
class ComponentHealth:
    """Individual component health"""
    status: str  # 'healthy' or 'unhealthy'
    message: str
```

### Error Response
```python
@dataclass
class ErrorResponse:
    """Error response to client"""
    error: str  # Error message
    error_id: str  # Unique error identifier
    message: Optional[str] = None  # Additional context
    traceback: Optional[str] = None  # Stack trace (dev only)
    request: Optional[dict] = None  # Request context (dev only)
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified several areas where properties can be consolidated:

- Properties 1.1 and 1.4 (debug mode in production/development) can be combined into a single property about debug mode matching environment
- Properties 2.4 and 2.5 (log level by environment) can be combined into a single property about log level configuration
- Properties 6.4 and 6.5 (stack trace exposure by environment) can be combined into a single property about error detail exposure
- Properties 10.1 and 10.2 (credential loading and logging) both relate to credential security and can be tested together
- Several health monitoring and shutdown properties are specific examples rather than universal properties

### Property 1: Debug Mode Configuration

*For any* environment setting (development, staging, production), the application's debug mode should be enabled only when the environment is 'development'.

**Validates: Requirements 1.1, 1.4**

### Property 2: Log Entry Structure

*For any* log entry written by the logger, the JSON output must contain the fields: timestamp, level, module, and message.

**Validates: Requirements 2.1, 2.2**

### Property 3: Log Level Support

*For any* standard Python log level (DEBUG, INFO, WARNING, ERROR, CRITICAL), the logger should accept and correctly format log entries at that level.

**Validates: Requirements 2.3**

### Property 4: Environment-Based Log Filtering

*For any* environment setting, when set to 'production' or 'staging', DEBUG level logs should not be written to the log file, and when set to 'development', DEBUG level logs should be written.

**Validates: Requirements 2.4, 2.5**

### Property 5: Configurable Log Directory

*For any* valid directory path provided as LOG_DIR configuration, the logger should write log files to that directory.

**Validates: Requirements 2.8**

### Property 6: Environment Variable Loading

*For any* configuration key that has a corresponding environment variable set, the Configuration_Manager should load the value from that environment variable.

**Validates: Requirements 3.1**

### Property 7: Environment Value Support

*For any* environment value in the set {development, staging, production}, the Configuration_Manager should successfully load configuration without errors.

**Validates: Requirements 3.2**

### Property 8: Required Variable Validation

*For any* required environment variable that is missing, the Configuration_Manager should raise a descriptive error that includes the variable name and prevent application startup.

**Validates: Requirements 3.3, 3.4**

### Property 9: Environment-Specific Defaults

*For any* configuration key with environment-specific defaults, the value should differ between development and production environments when no explicit value is provided.

**Validates: Requirements 3.5**

### Property 10: Credential Masking

*For any* sensitive configuration value (containing 'KEY', 'SECRET', 'PASSWORD', or 'TOKEN'), when logged or dumped, the value should be masked (e.g., '***') rather than exposed in plain text.

**Validates: Requirements 3.6, 10.2, 10.3**

### Property 11: Worker Count Calculation

*For any* system with N CPU cores, the production server worker count should be calculated as a function of N (e.g., 2*N + 1 or similar formula).

**Validates: Requirements 4.2**

### Property 12: Exception Interception

*For any* unhandled exception raised in a route handler, the Error_Handler should intercept it and prevent it from reaching the client as an unformatted error.

**Validates: Requirements 6.1**

### Property 13: Exception Logging

*For any* unhandled exception that occurs, the Error_Handler should log an entry at ERROR level that includes the full stack trace.

**Validates: Requirements 6.2**

### Property 14: Generic Error Response

*For any* unhandled exception in production environment, the error response to the client should not contain the original exception message or type, but rather a generic message.

**Validates: Requirements 6.3, 6.4**

### Property 15: Environment-Based Error Details

*For any* unhandled exception, when environment is 'development', the response should include stack trace details, and when environment is 'production', it should not.

**Validates: Requirements 6.4, 6.5**

### Property 16: Error Context Logging

*For any* error that is logged, the log entry should include request context fields: method, path, and headers.

**Validates: Requirements 6.6**

### Property 17: Unique Error IDs

*For any* two distinct error occurrences, each should be assigned a different error ID.

**Validates: Requirements 6.7**

### Property 18: Error ID in Response

*For any* error response sent to a client, the response should include an error_id field.

**Validates: Requirements 6.8**

### Property 19: Credential Source Validation

*For any* sensitive credential (SUPABASE_KEY, GOOGLE_CLIENT_ID, SECRET_KEY), the value should be loaded from environment variables and not from hardcoded values in the codebase.

**Validates: Requirements 10.1**

## Error Handling

The application implements a multi-layered error handling strategy:

### Exception Hierarchy

1. **Application Exceptions**: Custom exceptions for business logic errors
   - `ConfigurationError`: Raised when configuration is invalid
   - `DatabaseConnectionError`: Raised when database connectivity fails
   - `AuthenticationError`: Raised when authentication fails

2. **HTTP Exceptions**: Flask's built-in HTTP exceptions
   - 400 Bad Request: Invalid client input
   - 401 Unauthorized: Authentication required
   - 403 Forbidden: Insufficient permissions
   - 404 Not Found: Resource not found
   - 500 Internal Server Error: Unhandled exceptions

3. **External Service Exceptions**: Errors from external dependencies
   - Supabase connection errors
   - Google OAuth errors

### Error Handling Flow

```
Exception Raised
      ↓
Error Handler Intercepts
      ↓
Generate Error ID
      ↓
Log with Context (method, path, headers, stack trace)
      ↓
Format Response (environment-dependent)
      ↓
Return to Client (with error ID)
```

### Error Response Strategy

**Production Environment**:
- Generic error messages
- No stack traces
- No internal details
- Error ID for support tracking
- Appropriate HTTP status codes

**Development Environment**:
- Detailed error messages
- Full stack traces
- Request context
- Error ID
- Helpful debugging information

### Logging Strategy

All errors are logged with:
- ERROR level for unhandled exceptions
- WARNING level for handled exceptions (e.g., validation errors)
- Full stack trace
- Request context (method, path, headers, IP)
- Error ID for correlation
- Timestamp

### Recovery Mechanisms

1. **Database Connection Errors**: Retry with exponential backoff (handled by Supabase client)
2. **Transient Errors**: Return 503 Service Unavailable with Retry-After header
3. **Configuration Errors**: Fail fast at startup with descriptive error
4. **Validation Errors**: Return 400 with specific field errors

## Testing Strategy

This feature requires a dual testing approach combining unit tests for specific scenarios and property-based tests for universal behaviors.

### Property-Based Testing

We will use **Hypothesis** (Python's property-based testing library) to verify correctness properties. Each property test will run a minimum of 100 iterations with randomized inputs.

**Configuration**:
```python
from hypothesis import given, settings
import hypothesis.strategies as st

@settings(max_examples=100)
@given(...)
def test_property_name(...):
    # Feature: production-deployment-prep, Property N: [property text]
    pass
```

**Property Test Coverage**:

1. **Configuration Properties** (Properties 1, 6-11, 19)
   - Generate random environment configurations
   - Test debug mode, log levels, defaults, masking
   - Verify validation and error messages

2. **Logging Properties** (Properties 2-5)
   - Generate random log messages at various levels
   - Test JSON structure, field presence, filtering
   - Verify directory configuration

3. **Error Handling Properties** (Properties 12-18)
   - Generate random exceptions in route handlers
   - Test interception, logging, response formatting
   - Verify error IDs are unique and included in responses

**Example Property Test**:
```python
@settings(max_examples=100)
@given(
    env=st.sampled_from(['development', 'staging', 'production']),
    log_level=st.sampled_from(['DEBUG', 'INFO', 'WARNING', 'ERROR'])
)
def test_environment_based_log_filtering(env, log_level):
    """
    Feature: production-deployment-prep, Property 4: 
    For any environment setting, when set to 'production' or 'staging', 
    DEBUG level logs should not be written to the log file
    """
    # Setup logger with environment
    logger = setup_logger('test', env)
    
    # Log at the given level
    logger.log(log_level, "Test message")
    
    # Verify filtering behavior
    if env in ['production', 'staging'] and log_level == 'DEBUG':
        assert not log_was_written()
    else:
        assert log_was_written()
```

### Unit Testing

Unit tests focus on specific examples, edge cases, and integration points:

**Configuration Tests**:
- Missing required environment variables raise descriptive errors
- .gitignore validation detects missing .env entry
- Sensitive values are masked in configuration dumps
- Default values are correctly applied per environment

**Logging Tests**:
- Log rotation occurs at 10MB threshold
- Maximum of 5 backup files are retained
- JSON parsing of log entries succeeds
- Log directory creation when it doesn't exist

**Error Handling Tests**:
- Basic health endpoint returns 200
- Detailed health endpoint includes all required fields
- Database failure returns 503 from detailed health endpoint
- Health checks complete within 5 seconds

**Shutdown Tests**:
- Shutdown signal stops accepting new requests
- In-flight requests complete before shutdown
- Database connections are closed cleanly
- Force shutdown after 30-second timeout
- Shutdown events are logged at INFO level

**Server Configuration Tests**:
- Gunicorn worker count is calculated correctly
- Timeout values are set appropriately
- Development server is allowed in development environment

### Test Organization

```
backend/tests/
├── test_config.py              # Configuration Manager tests
├── test_logger.py              # Logger tests
├── test_error_handler.py       # Error Handler tests
├── test_health.py              # Health Monitor tests
├── test_shutdown.py            # Shutdown Handler tests
├── test_integration.py         # End-to-end integration tests
└── property_tests/
    ├── test_config_properties.py
    ├── test_logger_properties.py
    └── test_error_properties.py
```

### Integration Testing

Integration tests verify the complete flow:
1. Application startup with configuration loading
2. Request processing with logging
3. Error handling with proper responses
4. Health checks with database connectivity
5. Graceful shutdown with cleanup

### Test Data

- Use test-specific environment variables (`.env.test`)
- Mock Supabase client for database tests
- Use temporary directories for log file tests
- Mock signal handlers for shutdown tests

### Continuous Integration

All tests must pass before deployment:
- Unit tests: 100% pass rate required
- Property tests: 100 iterations per property, all must pass
- Integration tests: All scenarios must pass
- Code coverage: Minimum 80% for new code


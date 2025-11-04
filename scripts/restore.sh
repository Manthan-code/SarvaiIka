#!/bin/bash

# AI Agent Platform Database Restore Script
# This script restores PostgreSQL database from backup files

set -e  # Exit on any error

# Configuration
BACKUP_DIR="/backups"
RESTORE_LOG="/var/log/restore.log"

# Database configuration from environment
DB_HOST=${POSTGRES_HOST:-"localhost"}
DB_PORT=${POSTGRES_PORT:-5432}
DB_NAME=${POSTGRES_DB:-"aiagent"}
DB_USER=${POSTGRES_USER:-"postgres"}
DB_PASSWORD=${POSTGRES_PASSWORD}

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$RESTORE_LOG"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS] BACKUP_FILE"
    echo ""
    echo "Options:"
    echo "  -h, --help              Show this help message"
    echo "  -f, --force             Force restore without confirmation"
    echo "  -c, --clean             Drop existing database before restore"
    echo "  -s, --s3                Download backup from S3 bucket"
    echo "  -d, --date DATE         Restore from specific date (YYYYMMDD)"
    echo "  -l, --list              List available backups"
    echo "  --dry-run               Show what would be restored without doing it"
    echo ""
    echo "Examples:"
    echo "  $0 aiagent_backup_20240115_120000.dump"
    echo "  $0 -c -f aiagent_backup_20240115_120000.sql.gz"
    echo "  $0 -s -d 20240115"
    echo "  $0 -l"
}

# Function to list available backups
list_backups() {
    log "Available local backups:"
    if [ -d "$BACKUP_DIR" ]; then
        ls -la "$BACKUP_DIR"/aiagent_backup_* 2>/dev/null || echo "No local backups found"
    else
        echo "Backup directory $BACKUP_DIR does not exist"
    fi
    
    # List S3 backups if configured
    if [ -n "$S3_BUCKET" ] && command -v aws &> /dev/null; then
        log "Available S3 backups:"
        aws s3 ls "s3://$S3_BUCKET/database/" --recursive
    fi
}

# Function to download backup from S3
download_from_s3() {
    local date=$1
    local backup_pattern="aiagent_backup_${date}"
    
    if [ -z "$S3_BUCKET" ]; then
        log "ERROR: S3_BUCKET environment variable is not set"
        exit 1
    fi
    
    if ! command -v aws &> /dev/null; then
        log "ERROR: AWS CLI is not installed"
        exit 1
    fi
    
    log "Downloading backups from S3 for date: $date"
    
    # Create backup directory if it doesn't exist
    mkdir -p "$BACKUP_DIR"
    
    # Download available backups for the date
    aws s3 cp "s3://$S3_BUCKET/database/" "$BACKUP_DIR/" --recursive --exclude "*" --include "${backup_pattern}*"
    
    # Check if any files were downloaded
    if ! ls "$BACKUP_DIR"/${backup_pattern}* 1> /dev/null 2>&1; then
        log "ERROR: No backups found for date $date"
        exit 1
    fi
    
    log "Backups downloaded successfully"
}

# Function to validate backup file
validate_backup() {
    local backup_file=$1
    
    if [ ! -f "$backup_file" ]; then
        log "ERROR: Backup file $backup_file does not exist"
        exit 1
    fi
    
    if [ ! -s "$backup_file" ]; then
        log "ERROR: Backup file $backup_file is empty"
        exit 1
    fi
    
    # Check file type
    local file_type=$(file "$backup_file")
    log "Backup file type: $file_type"
    
    # Validate based on extension
    case "$backup_file" in
        *.dump)
            log "Detected PostgreSQL custom format backup"
            ;;
        *.sql.gz)
            log "Detected compressed SQL backup"
            ;;
        *.sql)
            log "Detected SQL backup"
            ;;
        *)
            log "WARNING: Unknown backup file format"
            ;;
    esac
}

# Function to create database if it doesn't exist
create_database() {
    log "Checking if database $DB_NAME exists..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Check if database exists
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        log "Database $DB_NAME already exists"
    else
        log "Creating database $DB_NAME..."
        createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
        log "Database $DB_NAME created successfully"
    fi
    
    unset PGPASSWORD
}

# Function to drop database
drop_database() {
    log "Dropping database $DB_NAME..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Terminate existing connections
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c \
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME';"
    
    # Drop database
    dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" --if-exists
    
    log "Database $DB_NAME dropped successfully"
    
    unset PGPASSWORD
}

# Function to restore from custom format backup
restore_custom_format() {
    local backup_file=$1
    
    log "Restoring from custom format backup: $backup_file"
    
    export PGPASSWORD="$DB_PASSWORD"
    
    pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --verbose --clean --no-owner --no-privileges \
        --exit-on-error \
        "$backup_file"
    
    if [ $? -eq 0 ]; then
        log "Custom format restore completed successfully"
    else
        log "ERROR: Custom format restore failed"
        exit 1
    fi
    
    unset PGPASSWORD
}

# Function to restore from SQL backup
restore_sql_backup() {
    local backup_file=$1
    
    log "Restoring from SQL backup: $backup_file"
    
    export PGPASSWORD="$DB_PASSWORD"
    
    if [[ "$backup_file" == *.gz ]]; then
        log "Decompressing and restoring SQL backup..."
        gunzip -c "$backup_file" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1
    else
        log "Restoring SQL backup..."
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$backup_file"
    fi
    
    if [ $? -eq 0 ]; then
        log "SQL restore completed successfully"
    else
        log "ERROR: SQL restore failed"
        exit 1
    fi
    
    unset PGPASSWORD
}

# Function to verify restore
verify_restore() {
    log "Verifying database restore..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Check if we can connect and run basic queries
    local table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
    
    log "Number of tables in restored database: $(echo $table_count | xargs)"
    
    # Run a simple query to check data integrity
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();"
    
    if [ $? -eq 0 ]; then
        log "Database restore verification successful"
    else
        log "ERROR: Database restore verification failed"
        exit 1
    fi
    
    unset PGPASSWORD
}

# Main restore function
perform_restore() {
    local backup_file=$1
    local clean_db=$2
    local force=$3
    
    # Validate backup file
    validate_backup "$backup_file"
    
    # Confirmation prompt
    if [ "$force" != "true" ]; then
        echo "WARNING: This will restore the database $DB_NAME from $backup_file"
        if [ "$clean_db" = "true" ]; then
            echo "The existing database will be DROPPED and recreated!"
        fi
        read -p "Are you sure you want to continue? (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            log "Restore cancelled by user"
            exit 0
        fi
    fi
    
    # Drop database if clean option is specified
    if [ "$clean_db" = "true" ]; then
        drop_database
    fi
    
    # Create database if it doesn't exist
    create_database
    
    # Perform restore based on file type
    case "$backup_file" in
        *.dump)
            restore_custom_format "$backup_file"
            ;;
        *.sql.gz|*.sql)
            restore_sql_backup "$backup_file"
            ;;
        *)
            log "ERROR: Unsupported backup file format"
            exit 1
            ;;
    esac
    
    # Verify restore
    verify_restore
    
    log "Database restore completed successfully at $(date)"
}

# Parse command line arguments
CLEAN_DB=false
FORCE=false
FROM_S3=false
DATE=""
DRY_RUN=false
BACKUP_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -c|--clean)
            CLEAN_DB=true
            shift
            ;;
        -s|--s3)
            FROM_S3=true
            shift
            ;;
        -d|--date)
            DATE="$2"
            shift 2
            ;;
        -l|--list)
            list_backups
            exit 0
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -*)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
        *)
            BACKUP_FILE="$1"
            shift
            ;;
    esac
done

# Main execution
log "Starting restore process..."

# Check if required environment variables are set
if [ -z "$DB_PASSWORD" ]; then
    log "ERROR: POSTGRES_PASSWORD environment variable is not set"
    exit 1
fi

# Handle S3 download
if [ "$FROM_S3" = "true" ]; then
    if [ -z "$DATE" ]; then
        log "ERROR: Date is required when restoring from S3 (-d option)"
        exit 1
    fi
    download_from_s3 "$DATE"
    
    # Find the downloaded backup file
    BACKUP_FILE=$(ls "$BACKUP_DIR"/aiagent_backup_${DATE}*.dump 2>/dev/null | head -1)
    if [ -z "$BACKUP_FILE" ]; then
        BACKUP_FILE=$(ls "$BACKUP_DIR"/aiagent_backup_${DATE}*.sql.gz 2>/dev/null | head -1)
    fi
    
    if [ -z "$BACKUP_FILE" ]; then
        log "ERROR: No suitable backup file found for date $DATE"
        exit 1
    fi
fi

# Check if backup file is specified
if [ -z "$BACKUP_FILE" ]; then
    log "ERROR: No backup file specified"
    show_usage
    exit 1
fi

# Convert to absolute path if relative
if [[ "$BACKUP_FILE" != /* ]]; then
    BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
fi

# Dry run
if [ "$DRY_RUN" = "true" ]; then
    log "DRY RUN: Would restore from $BACKUP_FILE"
    log "DRY RUN: Clean database: $CLEAN_DB"
    log "DRY RUN: Force: $FORCE"
    validate_backup "$BACKUP_FILE"
    exit 0
fi

# Perform the restore
perform_restore "$BACKUP_FILE" "$CLEAN_DB" "$FORCE"
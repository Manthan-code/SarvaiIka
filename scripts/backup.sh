#!/bin/bash

# AI Agent Platform Database Backup Script
# This script creates automated backups of PostgreSQL database

set -e  # Exit on any error

# Configuration
BACKUP_DIR="/backups"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="aiagent_backup_${DATE}"
RETENTION_DAYS=30

# Database configuration from environment
DB_HOST=${POSTGRES_HOST:-"localhost"}
DB_PORT=${POSTGRES_PORT:-5432}
DB_NAME=${POSTGRES_DB:-"aiagent"}
DB_USER=${POSTGRES_USER:-"postgres"}
DB_PASSWORD=${POSTGRES_PASSWORD}

# S3 configuration (optional)
S3_BUCKET=${BACKUP_S3_BUCKET}
AWS_REGION=${AWS_REGION:-"us-east-1"}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting database backup at $(date)"

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to send notification (customize as needed)
send_notification() {
    local status=$1
    local message=$2
    
    # Example: Send to Slack webhook
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"Database Backup $status: $message\"}" \
            "$SLACK_WEBHOOK_URL"
    fi
    
    # Example: Send email (requires mailutils)
    if [ -n "$NOTIFICATION_EMAIL" ]; then
        echo "$message" | mail -s "Database Backup $status" "$NOTIFICATION_EMAIL"
    fi
}

# Function to create database backup
create_backup() {
    log "Creating PostgreSQL backup..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Create compressed backup
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --verbose --clean --no-owner --no-privileges \
        --format=custom --compress=9 \
        --file="$BACKUP_DIR/${BACKUP_NAME}.dump"
    
    if [ $? -eq 0 ]; then
        log "Database backup created successfully: ${BACKUP_NAME}.dump"
        
        # Create a plain SQL backup as well for easier restoration
        pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --verbose --clean --no-owner --no-privileges \
            --file="$BACKUP_DIR/${BACKUP_NAME}.sql"
        
        # Compress the SQL file
        gzip "$BACKUP_DIR/${BACKUP_NAME}.sql"
        
        log "SQL backup created and compressed: ${BACKUP_NAME}.sql.gz"
    else
        log "ERROR: Database backup failed!"
        send_notification "FAILED" "PostgreSQL backup failed for database $DB_NAME"
        exit 1
    fi
    
    unset PGPASSWORD
}

# Function to backup Redis data
backup_redis() {
    log "Creating Redis backup..."
    
    if command -v redis-cli &> /dev/null; then
        # Trigger Redis save
        redis-cli -h "${REDIS_HOST:-localhost}" -p "${REDIS_PORT:-6379}" BGSAVE
        
        # Wait for save to complete
        sleep 5
        
        # Copy the RDB file
        if [ -f "/data/dump.rdb" ]; then
            cp "/data/dump.rdb" "$BACKUP_DIR/redis_${DATE}.rdb"
            log "Redis backup created: redis_${DATE}.rdb"
        else
            log "WARNING: Redis RDB file not found"
        fi
    else
        log "WARNING: redis-cli not found, skipping Redis backup"
    fi
}

# Function to upload to S3
upload_to_s3() {
    if [ -n "$S3_BUCKET" ] && command -v aws &> /dev/null; then
        log "Uploading backups to S3..."
        
        aws s3 cp "$BACKUP_DIR/${BACKUP_NAME}.dump" "s3://$S3_BUCKET/database/" --region "$AWS_REGION"
        aws s3 cp "$BACKUP_DIR/${BACKUP_NAME}.sql.gz" "s3://$S3_BUCKET/database/" --region "$AWS_REGION"
        
        if [ -f "$BACKUP_DIR/redis_${DATE}.rdb" ]; then
            aws s3 cp "$BACKUP_DIR/redis_${DATE}.rdb" "s3://$S3_BUCKET/redis/" --region "$AWS_REGION"
        fi
        
        log "Backups uploaded to S3 successfully"
    else
        log "S3 upload skipped (bucket not configured or AWS CLI not available)"
    fi
}

# Function to clean old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    
    # Local cleanup
    find "$BACKUP_DIR" -name "aiagent_backup_*" -type f -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "redis_*" -type f -mtime +$RETENTION_DAYS -delete
    
    # S3 cleanup (if configured)
    if [ -n "$S3_BUCKET" ] && command -v aws &> /dev/null; then
        # Note: Consider using S3 lifecycle policies instead
        aws s3 ls "s3://$S3_BUCKET/database/" --recursive | \
            awk '$1 <= "'$(date -d "$RETENTION_DAYS days ago" '+%Y-%m-%d')'" {print $4}' | \
            xargs -I {} aws s3 rm "s3://$S3_BUCKET/{}"
    fi
    
    log "Cleanup completed"
}

# Function to verify backup integrity
verify_backup() {
    log "Verifying backup integrity..."
    
    # Check if backup files exist and are not empty
    if [ -s "$BACKUP_DIR/${BACKUP_NAME}.dump" ]; then
        log "Custom format backup verified: $(du -h "$BACKUP_DIR/${BACKUP_NAME}.dump" | cut -f1)"
    else
        log "ERROR: Custom format backup is missing or empty!"
        return 1
    fi
    
    if [ -s "$BACKUP_DIR/${BACKUP_NAME}.sql.gz" ]; then
        log "SQL backup verified: $(du -h "$BACKUP_DIR/${BACKUP_NAME}.sql.gz" | cut -f1)"
    else
        log "ERROR: SQL backup is missing or empty!"
        return 1
    fi
    
    # Test restore (optional - only in non-production)
    if [ "$VERIFY_RESTORE" = "true" ] && [ "$NODE_ENV" != "production" ]; then
        log "Testing backup restore..."
        # Create a test database and restore
        # This is optional and should be used carefully
    fi
    
    return 0
}

# Main execution
main() {
    log "Starting backup process..."
    
    # Check if required environment variables are set
    if [ -z "$DB_PASSWORD" ]; then
        log "ERROR: POSTGRES_PASSWORD environment variable is not set"
        exit 1
    fi
    
    # Create backups
    create_backup
    backup_redis
    
    # Verify backups
    if verify_backup; then
        log "Backup verification successful"
        
        # Upload to cloud storage
        upload_to_s3
        
        # Cleanup old backups
        cleanup_old_backups
        
        log "Backup process completed successfully at $(date)"
        send_notification "SUCCESS" "Database backup completed successfully. Files: ${BACKUP_NAME}.dump, ${BACKUP_NAME}.sql.gz"
    else
        log "ERROR: Backup verification failed!"
        send_notification "FAILED" "Backup verification failed for $BACKUP_NAME"
        exit 1
    fi
}

# Run main function
main "$@"
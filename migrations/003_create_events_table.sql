-- Create Events table for calendar functionality
CREATE TABLE IF NOT EXISTS "Events" (
    "EventID" SERIAL NOT NULL,
    "Title" VARCHAR(200) NOT NULL,
    "Description" TEXT NULL,
    "StartDate" TIMESTAMP NOT NULL,
    "EndDate" TIMESTAMP NOT NULL,
    "AllDay" BOOLEAN NOT NULL DEFAULT FALSE,
    "Location" VARCHAR(200) NULL,
    "Color" VARCHAR(20) NULL DEFAULT '#3788d8',
    "CreatedBy" VARCHAR(450) NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "EventType" VARCHAR(50) NULL,
    "RelatedRequestID" INTEGER NULL,
    "Attendees" TEXT NULL, -- JSON array of user IDs
    "ReminderMinutes" INTEGER NULL,
    CONSTRAINT "PK_Events" PRIMARY KEY ("EventID"),
    CONSTRAINT "FK_Events_Users" FOREIGN KEY ("CreatedBy") 
        REFERENCES "Users" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Events_Requests" FOREIGN KEY ("RelatedRequestID") 
        REFERENCES "Requests" ("RequestID") ON DELETE SET NULL
);

-- Create index for faster queries
CREATE INDEX "IX_Events_CreatedBy" ON "Events" ("CreatedBy");
CREATE INDEX "IX_Events_StartDate" ON "Events" ("StartDate");
CREATE INDEX "IX_Events_EndDate" ON "Events" ("EndDate");
CREATE INDEX "IX_Events_RelatedRequestID" ON "Events" ("RelatedRequestID");

-- Insert sample events
INSERT INTO "Events" ("Title", "Description", "StartDate", "EndDate", "AllDay", "Color", "CreatedBy", "EventType")
SELECT 
    'Họp đầu tuần',
    'Họp tổng kết tuần và lên kế hoạch tuần mới',
    CURRENT_TIMESTAMP + INTERVAL '1 day',
    CURRENT_TIMESTAMP + INTERVAL '1 day' + INTERVAL '2 hours',
    FALSE,
    '#3788d8',
    "Id",
    'meeting'
FROM "Users" 
WHERE "UserName" = 'admin'
LIMIT 1;

INSERT INTO "Events" ("Title", "Description", "StartDate", "EndDate", "AllDay", "Color", "CreatedBy", "EventType")
SELECT 
    'Deadline dự án',
    'Hoàn thành báo cáo tháng',
    CURRENT_TIMESTAMP + INTERVAL '7 days',
    CURRENT_TIMESTAMP + INTERVAL '7 days',
    TRUE,
    '#f56565',
    "Id",
    'deadline'
FROM "Users" 
WHERE "UserName" = 'admin'
LIMIT 1;

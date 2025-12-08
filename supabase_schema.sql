-- PostgreSQL Schema for Supabase
-- Converted from SQL Server to PostgreSQL
-- Database: appmvc

-- Enable UUID extension for PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (in reverse order to handle dependencies)
DROP TABLE IF EXISTS "WorkflowDependencies" CASCADE;
DROP TABLE IF EXISTS "WorkflowSteps" CASCADE;
DROP TABLE IF EXISTS "Workflow" CASCADE;
DROP TABLE IF EXISTS "UserTokens" CASCADE;
DROP TABLE IF EXISTS "Users" CASCADE;
DROP TABLE IF EXISTS "UserRoles" CASCADE;
DROP TABLE IF EXISTS "UserLogins" CASCADE;
DROP TABLE IF EXISTS "UserClaims" CASCADE;
DROP TABLE IF EXISTS "SubWorkflowExecutions" CASCADE;
DROP TABLE IF EXISTS "Status" CASCADE;
DROP TABLE IF EXISTS "SentimentAnalysis" CASCADE;
DROP TABLE IF EXISTS "Roles" CASCADE;
DROP TABLE IF EXISTS "RoleClaims" CASCADE;
DROP TABLE IF EXISTS "RequestWorkflows" CASCADE;
DROP TABLE IF EXISTS "RequestViews" CASCADE;
DROP TABLE IF EXISTS "RequestStepHistory" CASCADE;
DROP TABLE IF EXISTS "RequestStars" CASCADE;
DROP TABLE IF EXISTS "Requests" CASCADE;
DROP TABLE IF EXISTS "RequestRatings" CASCADE;
DROP TABLE IF EXISTS "RequestHistories" CASCADE;
DROP TABLE IF EXISTS "RequestClassifications" CASCADE;
DROP TABLE IF EXISTS "RequestApprovals" CASCADE;
DROP TABLE IF EXISTS "Priority" CASCADE;
DROP TABLE IF EXISTS "PersonalTasks" CASCADE;
DROP TABLE IF EXISTS "Notifications" CASCADE;
DROP TABLE IF EXISTS "Messages" CASCADE;
DROP TABLE IF EXISTS "Departments" CASCADE;
DROP TABLE IF EXISTS "Comments" CASCADE;
DROP TABLE IF EXISTS "Chats" CASCADE;
DROP TABLE IF EXISTS "ChatMessages" CASCADE;
DROP TABLE IF EXISTS "ChatGroups" CASCADE;
DROP TABLE IF EXISTS "ChatGroupMembers" CASCADE;
DROP TABLE IF EXISTS "ChatConversations" CASCADE;
DROP TABLE IF EXISTS "__EFMigrationsHistory" CASCADE;

-- Create tables

-- EF Migrations History
CREATE TABLE "__EFMigrationsHistory" (
    "MigrationId" VARCHAR(150) NOT NULL,
    "ProductVersion" VARCHAR(32) NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

-- Chat Conversations
CREATE TABLE "ChatConversations" (
    "ConversationId" SERIAL NOT NULL,
    "UserId" VARCHAR(450) NOT NULL,
    "SessionId" VARCHAR(100) NOT NULL,
    "StartedAt" TIMESTAMP NOT NULL,
    "EndedAt" TIMESTAMP NULL,
    "Status" VARCHAR(50) NOT NULL,
    CONSTRAINT "PK_ChatConversations" PRIMARY KEY ("ConversationId")
);

-- Chat Group Members
CREATE TABLE "ChatGroupMembers" (
    "Id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "GroupId" UUID NOT NULL,
    "UserId" VARCHAR(450) NOT NULL,
    "IsAdmin" BOOLEAN NOT NULL,
    "JoinedAt" TIMESTAMP NOT NULL DEFAULT '2001-01-01 00:00:00',
    CONSTRAINT "PK_ChatGroupMembers" PRIMARY KEY ("Id")
);

-- Chat Groups
CREATE TABLE "ChatGroups" (
    "Id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "Name" TEXT NOT NULL,
    "Description" TEXT NOT NULL,
    "CreatedById" VARCHAR(450) NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "PK_ChatGroups" PRIMARY KEY ("Id")
);

-- Chat Messages
CREATE TABLE "ChatMessages" (
    "MessageId" SERIAL NOT NULL,
    "ConversationId" INTEGER NOT NULL,
    "Role" VARCHAR(20) NOT NULL,
    "Content" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL,
    "Metadata" TEXT NULL,
    "RequestId" INTEGER NULL,
    CONSTRAINT "PK_ChatMessages" PRIMARY KEY ("MessageId")
);

-- Chats
CREATE TABLE "Chats" (
    "Id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "Type" TEXT NOT NULL,
    "UserId" VARCHAR(450) NOT NULL,
    "GroupName" TEXT NOT NULL,
    "CreatedById" VARCHAR(450) NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "PK_Chats" PRIMARY KEY ("Id")
);

-- Comments
CREATE TABLE "Comments" (
    "CommentId" SERIAL NOT NULL,
    "Content" VARCHAR(100) NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL,
    "UpdatedAt" TIMESTAMP NULL,
    "RequestId" INTEGER NOT NULL,
    "UserId" VARCHAR(450) NOT NULL,
    CONSTRAINT "PK_Comments" PRIMARY KEY ("CommentId")
);

-- Departments
CREATE TABLE "Departments" (
    "DepartmentID" SERIAL NOT NULL,
    "Name" VARCHAR(50) NOT NULL,
    "Description" VARCHAR(255) NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL,
    "IsActive" BOOLEAN NOT NULL,
    "AssignedUserId" VARCHAR(450) NULL,
    CONSTRAINT "PK_Departments" PRIMARY KEY ("DepartmentID")
);

-- Messages
CREATE TABLE "Messages" (
    "Id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "Content" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL,
    "SenderId" VARCHAR(450) NOT NULL,
    "ReceiverId" VARCHAR(450) NULL,
    "GroupId" UUID NULL,
    "IsRead" BOOLEAN NOT NULL,
    "AttachmentPath" TEXT NULL,
    "AttachmentSize" BIGINT NULL,
    "AttachmentType" TEXT NULL,
    "DeletedAt" TIMESTAMP NULL,
    "EditedAt" TIMESTAMP NULL,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT FALSE,
    "IsEdited" BOOLEAN NOT NULL DEFAULT FALSE,
    "IsPinned" BOOLEAN NOT NULL DEFAULT FALSE,
    "OriginalFileName" TEXT NULL,
    "PinnedAt" TIMESTAMP NULL,
    CONSTRAINT "PK_Messages" PRIMARY KEY ("Id")
);

-- Notifications
CREATE TABLE "Notifications" (
    "Id" SERIAL NOT NULL,
    "Title" TEXT NOT NULL,
    "Content" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL,
    "IsRead" BOOLEAN NOT NULL,
    "Type" TEXT NOT NULL,
    "RequestId" INTEGER NULL,
    "UserId" VARCHAR(450) NOT NULL,
    "Link" TEXT NULL,
    CONSTRAINT "PK_Notifications" PRIMARY KEY ("Id")
);

-- Personal Tasks
CREATE TABLE "PersonalTasks" (
    "TaskId" SERIAL NOT NULL,
    "TaskName" VARCHAR(200) NOT NULL,
    "Description" VARCHAR(1000) NULL,
    "StartTime" TIMESTAMP NOT NULL,
    "EndTime" TIMESTAMP NOT NULL,
    "Priority" INTEGER NOT NULL,
    "PrerequisitesJson" VARCHAR(500) NULL,
    "UserId" VARCHAR(450) NOT NULL,
    "Status" INTEGER NOT NULL,
    "RelatedRequestId" INTEGER NULL,
    "IsCompleted" BOOLEAN NOT NULL,
    "CompletedAt" TIMESTAMP NULL,
    "CreatedAt" TIMESTAMP NOT NULL,
    "UpdatedAt" TIMESTAMP NOT NULL,
    "CompletionNotes" VARCHAR(1000) NULL,
    "ActualDuration" TIME NULL,
    "IsFlexible" BOOLEAN NOT NULL,
    "TaskType" VARCHAR(50) NOT NULL,
    "CanAdjustDuration" BOOLEAN NOT NULL DEFAULT FALSE,
    "CreatedFrom" VARCHAR(100) NULL,
    "IsUserDefined" BOOLEAN NOT NULL DEFAULT FALSE,
    "OriginalDuration" TIME NULL,
    CONSTRAINT "PK_PersonalTasks" PRIMARY KEY ("TaskId")
);

-- Priority
CREATE TABLE "Priority" (
    "PriorityID" SERIAL NOT NULL,
    "PriorityName" VARCHAR(50) NOT NULL,
    "ResolutionTime" INTEGER NULL,
    "ResponseTime" INTEGER NULL,
    "Description" VARCHAR(255) NOT NULL,
    "IsActive" BOOLEAN NOT NULL,
    "BusinessDays" VARCHAR(20) NOT NULL DEFAULT '',
    "BusinessEndHour" INTEGER NOT NULL DEFAULT 0,
    "BusinessStartHour" INTEGER NOT NULL DEFAULT 0,
    "ColorCode" VARCHAR(7) NULL,
    "CriticalThreshold" DECIMAL(5, 2) NOT NULL,
    "EscalationTime" INTEGER NULL,
    "FirstResponseTime" INTEGER NULL,
    "SlaTarget" DECIMAL(5, 2) NOT NULL,
    "SortOrder" INTEGER NOT NULL DEFAULT 0,
    "UseBusinessHoursOnly" BOOLEAN NOT NULL DEFAULT FALSE,
    "WarningThreshold" DECIMAL(5, 2) NOT NULL,
    CONSTRAINT "PK_Priority" PRIMARY KEY ("PriorityID")
);

-- Request Approvals
CREATE TABLE "RequestApprovals" (
    "Id" SERIAL NOT NULL,
    "RequestId" INTEGER NOT NULL,
    "ApprovedByUserId" VARCHAR(450) NOT NULL,
    "ApprovedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "Note" VARCHAR(2000) NULL,
    CONSTRAINT "PK_RequestApprovals" PRIMARY KEY ("Id")
);

-- Sentiment Analysis
CREATE TABLE "SentimentAnalysis" (
    "Id" SERIAL NOT NULL,
    "Sentiment" INTEGER NOT NULL,
    "PositiveScore" FLOAT NOT NULL,
    "NegativeScore" FLOAT NOT NULL,
    "NeutralScore" FLOAT NOT NULL,
    "SentimentSummary" TEXT NULL,
    CONSTRAINT "PK_SentimentAnalysis" PRIMARY KEY ("Id")
);

-- Request Classifications
CREATE TABLE "RequestClassifications" (
    "Id" SERIAL NOT NULL,
    "RequestId" INTEGER NOT NULL,
    "ConfidenceScore" FLOAT NOT NULL,
    "DetectedType" INTEGER NOT NULL,
    "DetectedPriority" INTEGER NOT NULL,
    "RecommendedDepartment" TEXT NULL,
    "EstimatedEffortHours" FLOAT NOT NULL,
    "SuggestedSLA" TEXT NULL,
    "ExtractedKeywords" TEXT NOT NULL,
    "SentimentId" INTEGER NOT NULL,
    "ClassificationReasoning" TEXT NULL,
    "ProcessedAt" TIMESTAMP NOT NULL,
    "ProcessedBy" TEXT NULL,
    "AIProvider" TEXT NULL,
    "ModelVersion" TEXT NULL,
    CONSTRAINT "PK_RequestClassifications" PRIMARY KEY ("Id")
);

-- Request Histories
CREATE TABLE "RequestHistories" (
    "HistoryID" SERIAL NOT NULL,
    "RequestID" INTEGER NOT NULL,
    "StepID" INTEGER NOT NULL,
    "UserID" VARCHAR(450) NOT NULL,
    "StartTime" TIMESTAMP NOT NULL,
    "EndTime" TIMESTAMP NULL,
    "Status" TEXT NOT NULL,
    "Note" TEXT NULL,
    CONSTRAINT "PK_RequestHistories" PRIMARY KEY ("HistoryID")
);

-- Request Ratings
CREATE TABLE "RequestRatings" (
    "RatingID" SERIAL NOT NULL,
    "RequestID" INTEGER NOT NULL,
    "UserId" VARCHAR(450) NOT NULL,
    "Rating" INTEGER NOT NULL,
    "ServiceQuality" INTEGER NOT NULL,
    "ResponseTime" INTEGER NOT NULL,
    "ProblemResolution" INTEGER NOT NULL,
    "Comment" VARCHAR(1000) NULL,
    "Suggestions" VARCHAR(500) NULL,
    "CreatedAt" TIMESTAMP NOT NULL,
    "IsAnonymous" BOOLEAN NOT NULL,
    CONSTRAINT "PK_RequestRatings" PRIMARY KEY ("RatingID")
);

-- Status
CREATE TABLE "Status" (
    "StatusID" SERIAL NOT NULL,
    "StatusName" VARCHAR(100) NOT NULL,
    "Description" TEXT NOT NULL DEFAULT '',
    "IsFinal" BOOLEAN NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "PK_Status" PRIMARY KEY ("StatusID")
);

-- Roles
CREATE TABLE "Roles" (
    "Id" VARCHAR(450) NOT NULL,
    "Name" VARCHAR(256) NULL,
    "NormalizedName" VARCHAR(256) NULL,
    "ConcurrencyStamp" TEXT NULL,
    "Discriminator" VARCHAR(13) NOT NULL DEFAULT '',
    CONSTRAINT "PK_Roles" PRIMARY KEY ("Id")
);

-- Workflow
CREATE TABLE "Workflow" (
    "WorkflowID" SERIAL NOT NULL,
    "WorkflowName" VARCHAR(255) NOT NULL,
    "PriorityID" INTEGER NULL,
    "Description" TEXT NULL,
    "IsActive" BOOLEAN NOT NULL,
    "FormSchema" TEXT NULL,
    CONSTRAINT "PK_Workflow" PRIMARY KEY ("WorkflowID")
);

-- Requests
CREATE TABLE "Requests" (
    "RequestID" SERIAL NOT NULL,
    "Title" VARCHAR(100) NOT NULL,
    "Description" TEXT NULL,
    "AttachmentURL" VARCHAR(100) NULL,
    "IsApproved" BOOLEAN NOT NULL,
    "StatusID" INTEGER NULL,
    "PriorityID" INTEGER NULL,
    "WorkflowID" INTEGER NULL,
    "CreatedAt" TIMESTAMP NOT NULL,
    "UpdatedAt" TIMESTAMP NOT NULL,
    "ClosedAt" TIMESTAMP NULL,
    "UsersId" VARCHAR(450) NOT NULL DEFAULT '',
    "AssignedUserId" VARCHAR(450) NULL,
    "CurrentStepOrder" INTEGER NOT NULL DEFAULT 0,
    "RoleId" TEXT NOT NULL DEFAULT '',
    "ApprovedAt" TIMESTAMP NULL,
    "IssueType" VARCHAR(50) NULL,
    "LinkedIssues" VARCHAR(255) NULL,
    "Resolution" VARCHAR(100) NULL,
    "AdditionalInfoRequest" TEXT NULL,
    "IsAdditionalInfoRequested" BOOLEAN NOT NULL DEFAULT FALSE,
    "AttachmentFileName" TEXT NULL,
    "AttachmentFileSize" BIGINT NULL,
    "AttachmentFileType" TEXT NULL,
    "AdditionalInfoRequestedAt" TIMESTAMP NULL,
    "FormData" TEXT NULL,
    CONSTRAINT "PK_Requests" PRIMARY KEY ("RequestID")
);

-- Request Stars
CREATE TABLE "RequestStars" (
    "RequestStarID" SERIAL NOT NULL,
    "RequestID" INTEGER NOT NULL,
    "UserId" VARCHAR(450) NOT NULL,
    "StarredAt" TIMESTAMP NOT NULL,
    CONSTRAINT "PK_RequestStars" PRIMARY KEY ("RequestStarID")
);

-- Request Step History
CREATE TABLE "RequestStepHistory" (
    "HistoryID" SERIAL NOT NULL,
    "RequestID" INTEGER NOT NULL,
    "StatusID" INTEGER NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP NULL,
    "AdditionalInfo" TEXT NULL,
    "AttachmentURL" TEXT NULL,
    "AttachmentFileName" TEXT NULL,
    "AttachmentFileSize" BIGINT NULL,
    "AttachmentFileType" TEXT NULL,
    "ActionByUserId" TEXT NULL,
    "ActionTime" TIMESTAMP NOT NULL DEFAULT NOW(),
    "Note" TEXT NULL,
    "StepOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PK_RequestStepHistory" PRIMARY KEY ("HistoryID")
);

-- Request Views
CREATE TABLE "RequestViews" (
    "RequestViewId" SERIAL NOT NULL,
    "RequestID" INTEGER NOT NULL,
    "UserId" VARCHAR(450) NOT NULL,
    "ViewedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "PK_RequestViews" PRIMARY KEY ("RequestViewId")
);

-- Request Workflows
CREATE TABLE "RequestWorkflows" (
    "RequestWorkflowID" SERIAL NOT NULL,
    "RequestID" INTEGER NOT NULL,
    "WorkflowID" INTEGER NOT NULL,
    "DepartmentID" INTEGER NULL,
    "CurrentStepOrder" INTEGER NOT NULL,
    "WorkflowStatus" VARCHAR(50) NOT NULL,
    "ProcessingPriority" INTEGER NOT NULL,
    "ProcessingType" VARCHAR(20) NOT NULL,
    "DependsOnRequestWorkflowID" INTEGER NULL,
    "AssignedUserId" VARCHAR(450) NULL,
    "StartedAt" TIMESTAMP NULL,
    "CompletedAt" TIMESTAMP NULL,
    "Note" TEXT NULL,
    "IsRequired" BOOLEAN NOT NULL,
    "IsActive" BOOLEAN NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL,
    "UpdatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "PK_RequestWorkflows" PRIMARY KEY ("RequestWorkflowID")
);

-- Role Claims
CREATE TABLE "RoleClaims" (
    "Id" SERIAL NOT NULL,
    "RoleId" VARCHAR(450) NOT NULL,
    "ClaimType" TEXT NULL,
    "ClaimValue" TEXT NULL,
    CONSTRAINT "PK_RoleClaims" PRIMARY KEY ("Id")
);

-- Sub Workflow Executions
CREATE TABLE "SubWorkflowExecutions" (
    "SubWorkflowExecutionID" SERIAL NOT NULL,
    "ParentRequestWorkflowID" INTEGER NOT NULL,
    "ParentStepID" INTEGER NOT NULL,
    "SubWorkflowID" INTEGER NOT NULL,
    "SubRequestWorkflowID" INTEGER NULL,
    "Status" VARCHAR(50) NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL,
    "CompletedAt" TIMESTAMP NULL,
    "Note" VARCHAR(500) NULL,
    "TriggeredByUserId" VARCHAR(450) NULL,
    CONSTRAINT "PK_SubWorkflowExecutions" PRIMARY KEY ("SubWorkflowExecutionID")
);

-- User Claims
CREATE TABLE "UserClaims" (
    "Id" SERIAL NOT NULL,
    "UserId" VARCHAR(450) NOT NULL,
    "ClaimType" TEXT NULL,
    "ClaimValue" TEXT NULL,
    CONSTRAINT "PK_UserClaims" PRIMARY KEY ("Id")
);

-- User Logins
CREATE TABLE "UserLogins" (
    "LoginProvider" VARCHAR(450) NOT NULL,
    "ProviderKey" VARCHAR(450) NOT NULL,
    "ProviderDisplayName" TEXT NULL,
    "UserId" VARCHAR(450) NOT NULL,
    CONSTRAINT "PK_UserLogins" PRIMARY KEY ("LoginProvider", "ProviderKey")
);

-- User Roles
CREATE TABLE "UserRoles" (
    "UserId" VARCHAR(450) NOT NULL,
    "RoleId" VARCHAR(450) NOT NULL,
    CONSTRAINT "PK_UserRoles" PRIMARY KEY ("UserId", "RoleId")
);

-- Users
CREATE TABLE "Users" (
    "Id" VARCHAR(450) NOT NULL,
    "DepartmentID" INTEGER NULL,
    "RolesId" VARCHAR(450) NULL,
    "UserName" VARCHAR(256) NULL,
    "NormalizedUserName" VARCHAR(256) NULL,
    "Email" VARCHAR(256) NULL,
    "NormalizedEmail" VARCHAR(256) NULL,
    "EmailConfirmed" BOOLEAN NOT NULL,
    "PasswordHash" TEXT NULL,
    "SecurityStamp" TEXT NULL,
    "ConcurrencyStamp" TEXT NULL,
    "PhoneNumber" TEXT NULL,
    "PhoneNumberConfirmed" BOOLEAN NOT NULL,
    "TwoFactorEnabled" BOOLEAN NOT NULL,
    "LockoutEnd" TIMESTAMPTZ NULL,
    "LockoutEnabled" BOOLEAN NOT NULL,
    "AccessFailedCount" INTEGER NOT NULL,
    "BirthDate" TIMESTAMP NULL,
    "HomeAdress" VARCHAR(400) NULL,
    "Avatar" VARCHAR(400) NULL,
    CONSTRAINT "PK_Users" PRIMARY KEY ("Id")
);

-- User Tokens
CREATE TABLE "UserTokens" (
    "UserId" VARCHAR(450) NOT NULL,
    "LoginProvider" VARCHAR(450) NOT NULL,
    "Name" VARCHAR(450) NOT NULL,
    "Value" TEXT NULL,
    CONSTRAINT "PK_UserTokens" PRIMARY KEY ("UserId", "LoginProvider", "Name")
);

-- Workflow Dependencies
CREATE TABLE "WorkflowDependencies" (
    "WorkflowDependencyID" SERIAL NOT NULL,
    "DependentWorkflowID" INTEGER NOT NULL,
    "PrerequisiteWorkflowID" INTEGER NOT NULL,
    "DependencyType" VARCHAR(20) NOT NULL,
    "Description" VARCHAR(500) NULL,
    "IsActive" BOOLEAN NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "PK_WorkflowDependencies" PRIMARY KEY ("WorkflowDependencyID")
);

-- Workflow Steps
CREATE TABLE "WorkflowSteps" (
    "StepID" SERIAL NOT NULL,
    "WorkflowID" INTEGER NULL,
    "StepName" VARCHAR(100) NOT NULL,
    "StepOrder" INTEGER NOT NULL,
    "RequiredRoleId" VARCHAR(450) NULL,
    "TimeLimitHours" INTEGER NULL,
    "ApprovalRequired" BOOLEAN NOT NULL,
    "StatusID" INTEGER NULL,
    "AssignedUserId" VARCHAR(450) NULL,
    "RequiresSubWorkflow" BOOLEAN NOT NULL DEFAULT FALSE,
    "SubWorkflowCompletionRequired" BOOLEAN NOT NULL DEFAULT FALSE,
    "SubWorkflowID" INTEGER NULL,
    CONSTRAINT "PK_WorkflowSteps" PRIMARY KEY ("StepID")
);

-- Create Indexes

-- Chat Group Members Indexes
CREATE INDEX "IX_ChatGroupMembers_GroupId" ON "ChatGroupMembers" ("GroupId");
CREATE INDEX "IX_ChatGroupMembers_UserId" ON "ChatGroupMembers" ("UserId");

-- Chat Groups Indexes
CREATE INDEX "IX_ChatGroups_CreatedById" ON "ChatGroups" ("CreatedById");

-- Chat Messages Indexes
CREATE INDEX "IX_ChatMessages_ConversationId" ON "ChatMessages" ("ConversationId");

-- Chats Indexes
CREATE INDEX "IX_Chats_CreatedById" ON "Chats" ("CreatedById");
CREATE INDEX "IX_Chats_UserId" ON "Chats" ("UserId");

-- Comments Indexes
CREATE INDEX "IX_Comments_RequestId" ON "Comments" ("RequestId");
CREATE INDEX "IX_Comments_UserId" ON "Comments" ("UserId");

-- Messages Indexes
CREATE INDEX "IX_Messages_GroupId" ON "Messages" ("GroupId");
CREATE INDEX "IX_Messages_ReceiverId" ON "Messages" ("ReceiverId");
CREATE INDEX "IX_Messages_SenderId" ON "Messages" ("SenderId");

-- Notifications Indexes
CREATE INDEX "IX_Notifications_RequestId" ON "Notifications" ("RequestId");
CREATE INDEX "IX_Notifications_UserId" ON "Notifications" ("UserId");

-- Personal Tasks Indexes
CREATE INDEX "IX_PersonalTasks_RelatedRequestId" ON "PersonalTasks" ("RelatedRequestId");
CREATE INDEX "IX_PersonalTasks_Status" ON "PersonalTasks" ("Status");
CREATE INDEX "IX_PersonalTasks_UserId_StartTime" ON "PersonalTasks" ("UserId", "StartTime");

-- Request Classifications Indexes
CREATE INDEX "IX_RequestClassifications_SentimentId" ON "RequestClassifications" ("SentimentId");

-- Request Ratings Indexes
CREATE UNIQUE INDEX "IX_RequestRatings_RequestID_UserId" ON "RequestRatings" ("RequestID", "UserId");
CREATE INDEX "IX_RequestRatings_UserId" ON "RequestRatings" ("UserId");

-- Requests Indexes
CREATE INDEX "IX_Requests_AssignedUserId" ON "Requests" ("AssignedUserId");
CREATE INDEX "IX_Requests_PriorityID" ON "Requests" ("PriorityID");
CREATE INDEX "IX_Requests_StatusID" ON "Requests" ("StatusID");
CREATE INDEX "IX_Requests_UsersId" ON "Requests" ("UsersId");
CREATE INDEX "IX_Requests_WorkflowID" ON "Requests" ("WorkflowID");

-- Request Stars Indexes
CREATE UNIQUE INDEX "IX_RequestStars_RequestID_UserId" ON "RequestStars" ("RequestID", "UserId");
CREATE INDEX "IX_RequestStars_UserId" ON "RequestStars" ("UserId");

-- Request Step History Indexes
CREATE INDEX "IX_RequestStepHistory_RequestID" ON "RequestStepHistory" ("RequestID");
CREATE INDEX "IX_RequestStepHistory_StatusID" ON "RequestStepHistory" ("StatusID");

-- Request Views Indexes
CREATE INDEX "IX_RequestViews_RequestID" ON "RequestViews" ("RequestID");
CREATE UNIQUE INDEX "IX_RequestViews_RequestID_UserId_ViewedAt" ON "RequestViews" ("RequestID", "UserId", "ViewedAt");

-- Request Workflows Indexes
CREATE INDEX "IX_RequestWorkflows_AssignedUserId" ON "RequestWorkflows" ("AssignedUserId");
CREATE INDEX "IX_RequestWorkflows_DepartmentID" ON "RequestWorkflows" ("DepartmentID");
CREATE INDEX "IX_RequestWorkflows_DependsOnRequestWorkflowID" ON "RequestWorkflows" ("DependsOnRequestWorkflowID");
CREATE INDEX "IX_RequestWorkflows_ProcessingPriority" ON "RequestWorkflows" ("ProcessingPriority");
CREATE UNIQUE INDEX "IX_RequestWorkflows_RequestID_WorkflowID" ON "RequestWorkflows" ("RequestID", "WorkflowID");
CREATE INDEX "IX_RequestWorkflows_WorkflowID" ON "RequestWorkflows" ("WorkflowID");
CREATE INDEX "IX_RequestWorkflows_WorkflowStatus" ON "RequestWorkflows" ("WorkflowStatus");

-- Role Claims Indexes
CREATE INDEX "IX_RoleClaims_RoleId" ON "RoleClaims" ("RoleId");

-- Roles Indexes
CREATE UNIQUE INDEX "RoleNameIndex" ON "Roles" ("NormalizedName") WHERE "NormalizedName" IS NOT NULL;

-- Sub Workflow Executions Indexes
CREATE INDEX "IX_SubWorkflowExecutions_ParentRequestWorkflowID" ON "SubWorkflowExecutions" ("ParentRequestWorkflowID");
CREATE INDEX "IX_SubWorkflowExecutions_ParentStepID" ON "SubWorkflowExecutions" ("ParentStepID");
CREATE INDEX "IX_SubWorkflowExecutions_SubRequestWorkflowID" ON "SubWorkflowExecutions" ("SubRequestWorkflowID");
CREATE INDEX "IX_SubWorkflowExecutions_SubWorkflowID" ON "SubWorkflowExecutions" ("SubWorkflowID");
CREATE INDEX "IX_SubWorkflowExecutions_TriggeredByUserId" ON "SubWorkflowExecutions" ("TriggeredByUserId");

-- User Claims Indexes
CREATE INDEX "IX_UserClaims_UserId" ON "UserClaims" ("UserId");

-- User Logins Indexes
CREATE INDEX "IX_UserLogins_UserId" ON "UserLogins" ("UserId");

-- User Roles Indexes
CREATE INDEX "IX_UserRoles_RoleId" ON "UserRoles" ("RoleId");

-- Users Indexes
CREATE INDEX "EmailIndex" ON "Users" ("NormalizedEmail");
CREATE INDEX "IX_Users_DepartmentID" ON "Users" ("DepartmentID");
CREATE INDEX "IX_Users_RolesId" ON "Users" ("RolesId");
CREATE UNIQUE INDEX "UserNameIndex" ON "Users" ("NormalizedUserName") WHERE "NormalizedUserName" IS NOT NULL;

-- Workflow Indexes
CREATE INDEX "IX_Workflow_PriorityID" ON "Workflow" ("PriorityID");

-- Workflow Dependencies Indexes
CREATE UNIQUE INDEX "IX_WorkflowDependencies_Dependent_Prerequisite" ON "WorkflowDependencies" ("DependentWorkflowID", "PrerequisiteWorkflowID");
CREATE INDEX "IX_WorkflowDependencies_PrerequisiteWorkflowID" ON "WorkflowDependencies" ("PrerequisiteWorkflowID");

-- Workflow Steps Indexes
CREATE INDEX "IX_WorkflowSteps_AssignedUserId" ON "WorkflowSteps" ("AssignedUserId");
CREATE INDEX "IX_WorkflowSteps_RequiredRoleId" ON "WorkflowSteps" ("RequiredRoleId");
CREATE INDEX "IX_WorkflowSteps_StatusID" ON "WorkflowSteps" ("StatusID");
CREATE INDEX "IX_WorkflowSteps_SubWorkflowID" ON "WorkflowSteps" ("SubWorkflowID");
CREATE INDEX "IX_WorkflowSteps_WorkflowID" ON "WorkflowSteps" ("WorkflowID");

-- Add Foreign Key Constraints

-- Chat Group Members
ALTER TABLE "ChatGroupMembers" 
    ADD CONSTRAINT "FK_ChatGroupMembers_ChatGroups_GroupId" 
    FOREIGN KEY ("GroupId") REFERENCES "ChatGroups" ("Id") ON DELETE CASCADE;

ALTER TABLE "ChatGroupMembers" 
    ADD CONSTRAINT "FK_ChatGroupMembers_Users_UserId" 
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id");

-- Chat Groups
ALTER TABLE "ChatGroups" 
    ADD CONSTRAINT "FK_ChatGroups_Users_CreatedById" 
    FOREIGN KEY ("CreatedById") REFERENCES "Users" ("Id") ON DELETE CASCADE;

-- Chat Messages
ALTER TABLE "ChatMessages" 
    ADD CONSTRAINT "FK_ChatMessages_ChatConversations_ConversationId" 
    FOREIGN KEY ("ConversationId") REFERENCES "ChatConversations" ("ConversationId") ON DELETE CASCADE;

-- Chats
ALTER TABLE "Chats" 
    ADD CONSTRAINT "FK_Chats_Users_CreatedById" 
    FOREIGN KEY ("CreatedById") REFERENCES "Users" ("Id") ON DELETE CASCADE;

ALTER TABLE "Chats" 
    ADD CONSTRAINT "FK_Chats_Users_UserId" 
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id");

-- Comments
ALTER TABLE "Comments" 
    ADD CONSTRAINT "FK_Comments_Requests_RequestId" 
    FOREIGN KEY ("RequestId") REFERENCES "Requests" ("RequestID");

ALTER TABLE "Comments" 
    ADD CONSTRAINT "FK_Comments_Users_UserId" 
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id");

-- Messages
ALTER TABLE "Messages" 
    ADD CONSTRAINT "FK_Messages_ChatGroups_GroupId" 
    FOREIGN KEY ("GroupId") REFERENCES "ChatGroups" ("Id");

ALTER TABLE "Messages" 
    ADD CONSTRAINT "FK_Messages_Users_ReceiverId" 
    FOREIGN KEY ("ReceiverId") REFERENCES "Users" ("Id");

ALTER TABLE "Messages" 
    ADD CONSTRAINT "FK_Messages_Users_SenderId" 
    FOREIGN KEY ("SenderId") REFERENCES "Users" ("Id") ON DELETE CASCADE;

-- Notifications
ALTER TABLE "Notifications" 
    ADD CONSTRAINT "FK_Notifications_Requests_RequestId" 
    FOREIGN KEY ("RequestId") REFERENCES "Requests" ("RequestID") ON DELETE CASCADE;

ALTER TABLE "Notifications" 
    ADD CONSTRAINT "FK_Notifications_Users_UserId" 
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id");

-- Personal Tasks
ALTER TABLE "PersonalTasks" 
    ADD CONSTRAINT "FK_PersonalTasks_Requests_RelatedRequestId" 
    FOREIGN KEY ("RelatedRequestId") REFERENCES "Requests" ("RequestID") ON DELETE SET NULL;

ALTER TABLE "PersonalTasks" 
    ADD CONSTRAINT "FK_PersonalTasks_Users_UserId" 
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE;

-- Request Approvals
ALTER TABLE "RequestApprovals" 
    ADD CONSTRAINT "FK_RequestApprovals_AspNetUsers" 
    FOREIGN KEY ("ApprovedByUserId") REFERENCES "Users" ("Id");

ALTER TABLE "RequestApprovals" 
    ADD CONSTRAINT "FK_RequestApprovals_Requests" 
    FOREIGN KEY ("RequestId") REFERENCES "Requests" ("RequestID");

-- Request Classifications
ALTER TABLE "RequestClassifications" 
    ADD CONSTRAINT "FK_RequestClassifications_SentimentAnalysis_SentimentId" 
    FOREIGN KEY ("SentimentId") REFERENCES "SentimentAnalysis" ("Id") ON DELETE CASCADE;

-- Request Histories
ALTER TABLE "RequestHistories" 
    ADD CONSTRAINT "FK_RequestHistories_Request" 
    FOREIGN KEY ("RequestID") REFERENCES "Requests" ("RequestID") ON DELETE CASCADE;

ALTER TABLE "RequestHistories" 
    ADD CONSTRAINT "FK_RequestHistories_User" 
    FOREIGN KEY ("UserID") REFERENCES "Users" ("Id");

ALTER TABLE "RequestHistories" 
    ADD CONSTRAINT "FK_RequestHistories_WorkflowStep" 
    FOREIGN KEY ("StepID") REFERENCES "WorkflowSteps" ("StepID");

-- Request Ratings
ALTER TABLE "RequestRatings" 
    ADD CONSTRAINT "FK_RequestRatings_Requests_RequestID" 
    FOREIGN KEY ("RequestID") REFERENCES "Requests" ("RequestID") ON DELETE CASCADE;

ALTER TABLE "RequestRatings" 
    ADD CONSTRAINT "FK_RequestRatings_Users_UserId" 
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id");

-- Requests
ALTER TABLE "Requests" 
    ADD CONSTRAINT "FK_Requests_Priority_PriorityID" 
    FOREIGN KEY ("PriorityID") REFERENCES "Priority" ("PriorityID");

ALTER TABLE "Requests" 
    ADD CONSTRAINT "FK_Requests_Status_StatusID" 
    FOREIGN KEY ("StatusID") REFERENCES "Status" ("StatusID");

ALTER TABLE "Requests" 
    ADD CONSTRAINT "FK_Requests_Users_AssignedUserId" 
    FOREIGN KEY ("AssignedUserId") REFERENCES "Users" ("Id");

ALTER TABLE "Requests" 
    ADD CONSTRAINT "FK_Requests_Users_UsersId" 
    FOREIGN KEY ("UsersId") REFERENCES "Users" ("Id");

ALTER TABLE "Requests" 
    ADD CONSTRAINT "FK_Requests_Workflow_WorkflowID" 
    FOREIGN KEY ("WorkflowID") REFERENCES "Workflow" ("WorkflowID");

-- Request Stars
ALTER TABLE "RequestStars" 
    ADD CONSTRAINT "FK_RequestStars_Requests_RequestID" 
    FOREIGN KEY ("RequestID") REFERENCES "Requests" ("RequestID") ON DELETE CASCADE;

ALTER TABLE "RequestStars" 
    ADD CONSTRAINT "FK_RequestStars_Users_UserId" 
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE;

-- Request Views
ALTER TABLE "RequestViews" 
    ADD CONSTRAINT "FK_RequestViews_Requests_RequestID" 
    FOREIGN KEY ("RequestID") REFERENCES "Requests" ("RequestID") ON DELETE CASCADE;

ALTER TABLE "RequestViews" 
    ADD CONSTRAINT "FK_RequestViews_Users_UserId" 
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE;

-- Request Workflows
ALTER TABLE "RequestWorkflows" 
    ADD CONSTRAINT "FK_RequestWorkflows_Departments_DepartmentID" 
    FOREIGN KEY ("DepartmentID") REFERENCES "Departments" ("DepartmentID") ON DELETE SET NULL;

ALTER TABLE "RequestWorkflows" 
    ADD CONSTRAINT "FK_RequestWorkflows_Requests_RequestID" 
    FOREIGN KEY ("RequestID") REFERENCES "Requests" ("RequestID") ON DELETE CASCADE;

ALTER TABLE "RequestWorkflows" 
    ADD CONSTRAINT "FK_RequestWorkflows_RequestWorkflows_DependsOnRequestWorkflowID" 
    FOREIGN KEY ("DependsOnRequestWorkflowID") REFERENCES "RequestWorkflows" ("RequestWorkflowID");

ALTER TABLE "RequestWorkflows" 
    ADD CONSTRAINT "FK_RequestWorkflows_Users_AssignedUserId" 
    FOREIGN KEY ("AssignedUserId") REFERENCES "Users" ("Id") ON DELETE SET NULL;

ALTER TABLE "RequestWorkflows" 
    ADD CONSTRAINT "FK_RequestWorkflows_Workflow_WorkflowID" 
    FOREIGN KEY ("WorkflowID") REFERENCES "Workflow" ("WorkflowID");

-- Role Claims
ALTER TABLE "RoleClaims" 
    ADD CONSTRAINT "FK_RoleClaims_Roles_RoleId" 
    FOREIGN KEY ("RoleId") REFERENCES "Roles" ("Id") ON DELETE CASCADE;

-- Sub Workflow Executions
ALTER TABLE "SubWorkflowExecutions" 
    ADD CONSTRAINT "FK_SubWorkflowExecutions_RequestWorkflows_ParentRequestWorkflowID" 
    FOREIGN KEY ("ParentRequestWorkflowID") REFERENCES "RequestWorkflows" ("RequestWorkflowID") ON DELETE CASCADE;

ALTER TABLE "SubWorkflowExecutions" 
    ADD CONSTRAINT "FK_SubWorkflowExecutions_RequestWorkflows_SubRequestWorkflowID" 
    FOREIGN KEY ("SubRequestWorkflowID") REFERENCES "RequestWorkflows" ("RequestWorkflowID");

ALTER TABLE "SubWorkflowExecutions" 
    ADD CONSTRAINT "FK_SubWorkflowExecutions_Users_TriggeredByUserId" 
    FOREIGN KEY ("TriggeredByUserId") REFERENCES "Users" ("Id");

ALTER TABLE "SubWorkflowExecutions" 
    ADD CONSTRAINT "FK_SubWorkflowExecutions_Workflow_SubWorkflowID" 
    FOREIGN KEY ("SubWorkflowID") REFERENCES "Workflow" ("WorkflowID");

ALTER TABLE "SubWorkflowExecutions" 
    ADD CONSTRAINT "FK_SubWorkflowExecutions_WorkflowSteps_ParentStepID" 
    FOREIGN KEY ("ParentStepID") REFERENCES "WorkflowSteps" ("StepID");

-- User Claims
ALTER TABLE "UserClaims" 
    ADD CONSTRAINT "FK_UserClaims_Users_UserId" 
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE;

-- User Logins
ALTER TABLE "UserLogins" 
    ADD CONSTRAINT "FK_UserLogins_Users_UserId" 
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE;

-- User Roles
ALTER TABLE "UserRoles" 
    ADD CONSTRAINT "FK_UserRoles_Roles_RoleId" 
    FOREIGN KEY ("RoleId") REFERENCES "Roles" ("Id") ON DELETE CASCADE;

ALTER TABLE "UserRoles" 
    ADD CONSTRAINT "FK_UserRoles_Users_UserId" 
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE;

-- Users
ALTER TABLE "Users" 
    ADD CONSTRAINT "FK_Users_Departments_DepartmentID" 
    FOREIGN KEY ("DepartmentID") REFERENCES "Departments" ("DepartmentID");

ALTER TABLE "Users" 
    ADD CONSTRAINT "FK_Users_Roles_RolesId" 
    FOREIGN KEY ("RolesId") REFERENCES "Roles" ("Id");

-- User Tokens
ALTER TABLE "UserTokens" 
    ADD CONSTRAINT "FK_UserTokens_Users_UserId" 
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE;

-- Workflow
ALTER TABLE "Workflow" 
    ADD CONSTRAINT "FK_Workflow_Priority_PriorityID" 
    FOREIGN KEY ("PriorityID") REFERENCES "Priority" ("PriorityID");

-- Workflow Dependencies
ALTER TABLE "WorkflowDependencies" 
    ADD CONSTRAINT "FK_WorkflowDependencies_Workflow_DependentWorkflowID" 
    FOREIGN KEY ("DependentWorkflowID") REFERENCES "Workflow" ("WorkflowID");

ALTER TABLE "WorkflowDependencies" 
    ADD CONSTRAINT "FK_WorkflowDependencies_Workflow_PrerequisiteWorkflowID" 
    FOREIGN KEY ("PrerequisiteWorkflowID") REFERENCES "Workflow" ("WorkflowID");

-- Workflow Steps
ALTER TABLE "WorkflowSteps" 
    ADD CONSTRAINT "FK_WorkflowSteps_Roles_RequiredRoleId" 
    FOREIGN KEY ("RequiredRoleId") REFERENCES "Roles" ("Id");

ALTER TABLE "WorkflowSteps" 
    ADD CONSTRAINT "FK_WorkflowSteps_Status_StatusID" 
    FOREIGN KEY ("StatusID") REFERENCES "Status" ("StatusID");

ALTER TABLE "WorkflowSteps" 
    ADD CONSTRAINT "FK_WorkflowSteps_Users_AssignedUserId" 
    FOREIGN KEY ("AssignedUserId") REFERENCES "Users" ("Id");

ALTER TABLE "WorkflowSteps" 
    ADD CONSTRAINT "FK_WorkflowSteps_Workflow_SubWorkflowID" 
    FOREIGN KEY ("SubWorkflowID") REFERENCES "Workflow" ("WorkflowID");

ALTER TABLE "WorkflowSteps" 
    ADD CONSTRAINT "FK_WorkflowSteps_Workflow_WorkflowID" 
    FOREIGN KEY ("WorkflowID") REFERENCES "Workflow" ("WorkflowID") ON DELETE CASCADE;

-- Check Constraints
ALTER TABLE "WorkflowDependencies" 
    ADD CONSTRAINT "CK_WorkflowDependency_NoSelfDependency" 
    CHECK ("DependentWorkflowID" != "PrerequisiteWorkflowID");

-- Supabase Optimizations

-- Enable Row Level Security (RLS) on sensitive tables
ALTER TABLE "Users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PersonalTasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RequestRatings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RequestStars" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RequestViews" ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (examples ``- customize based on your security requirements)

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON "Users"
    FOR SELECT USING (auth.uid()::text = "Id");

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON "Users"
    FOR UPDATE USING (auth.uid()::text = "Id");

-- Users can view requests they created or are assigned to
CREATE POLICY "Users can view related requests" ON "Requests"
    FOR SELECT USING (
        auth.uid()::text = "UsersId" OR 
        auth.uid()::text = "AssignedUserId"
    );

-- Users can view comments on requests they have access to
CREATE POLICY "Users can view comments on accessible requests" ON "Comments"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "Requests" r 
            WHERE r."RequestID" = "Comments"."RequestId" 
            AND (r."UsersId" = auth.uid()::text OR r."AssignedUserId" = auth.uid()::text)
        )
    );

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON "Notifications"
    FOR SELECT USING (auth.uid()::text = "UserId");

-- Users can view their own personal tasks
CREATE POLICY "Users can view own tasks" ON "PersonalTasks"
    FOR SELECT USING (auth.uid()::text = "UserId");

-- Users can manage their own personal tasks
CREATE POLICY "Users can manage own tasks" ON "PersonalTasks"
    FOR ALL USING (auth.uid()::text = "UserId");

-- Users can view messages they sent or received
CREATE POLICY "Users can view own messages" ON "Messages"
    FOR SELECT USING (
        auth.uid()::text = "SenderId" OR 
        auth.uid()::text = "ReceiverId" OR
        EXISTS (
            SELECT 1 FROM "ChatGroupMembers" cgm 
            WHERE cgm."GroupId" = "Messages"."GroupId" 
            AND cgm."UserId" = auth.uid()::text
        )
    );

-- Create functions for common operations
CREATE OR REPLACE FUNCTION get_user_requests(user_id TEXT)
RETURNS SETOF "Requests" AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM "Requests"
    WHERE "UsersId" = user_id OR "AssignedUserId" = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get request statistics
CREATE OR REPLACE FUNCTION get_request_stats(user_id TEXT)
RETURNS TABLE(
    total_requests BIGINT,
    pending_requests BIGINT,
    completed_requests BIGINT,
    assigned_requests BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE s."IsFinal" = false) as pending_requests,
        COUNT(*) FILTER (WHERE s."IsFinal" = true) as completed_requests,
        COUNT(*) FILTER (WHERE r."AssignedUserId" = user_id) as assigned_requests
    FROM "Requests" r
    LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
    WHERE r."UsersId" = user_id OR r."AssignedUserId" = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."UpdatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers for tables with UpdatedAt columns
CREATE TRIGGER update_requests_updated_at 
    BEFORE UPDATE ON "Requests" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_personaltasks_updated_at 
    BEFORE UPDATE ON "PersonalTasks" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_requestworkflows_updated_at 
    BEFORE UPDATE ON "RequestWorkflows" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance on commonly queried columns
CREATE INDEX IF NOT EXISTS "idx_requests_created_at" ON "Requests" ("CreatedAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_requests_status_priority" ON "Requests" ("StatusID", "PriorityID");
CREATE INDEX IF NOT EXISTS "idx_messages_created_at" ON "Messages" ("CreatedAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_notifications_created_at" ON "Notifications" ("CreatedAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_personaltasks_dates" ON "PersonalTasks" ("StartTime", "EndTime");

-- Create a view for user dashboard data
CREATE VIEW "user_dashboard" AS
SELECT 
    u."Id",
    u."UserName",
    u."Email",
    d."Name" as "DepartmentName",
    (SELECT COUNT(*) FROM "Requests" r WHERE r."UsersId" = u."Id") as "TotalRequests",
    (SELECT COUNT(*) FROM "Requests" r JOIN "Status" s ON r."StatusID" = s."StatusID" 
     WHERE r."UsersId" = u."Id" AND s."IsFinal" = false) as "PendingRequests",
    (SELECT COUNT(*) FROM "PersonalTasks" pt WHERE pt."UserId" = u."Id" AND pt."IsCompleted" = false) as "PendingTasks",
    (SELECT COUNT(*) FROM "Notifications" n WHERE n."UserId" = u."Id" AND n."IsRead" = false) as "UnreadNotifications"
FROM "Users" u
LEFT JOIN "Departments" d ON u."DepartmentID" = d."DepartmentID";

-- Create a view for request details
CREATE VIEW "request_details" AS
SELECT 
    r."RequestID",
    r."Title",
    r."Description",
    r."CreatedAt",
    r."UpdatedAt",
    r."ClosedAt",
    u."UserName" as "CreatedByUser",
    au."UserName" as "AssignedToUser",
    s."StatusName",
    p."PriorityName",
    w."WorkflowName",
    d."Name" as "DepartmentName"
FROM "Requests" r
LEFT JOIN "Users" u ON r."UsersId" = u."Id"
LEFT JOIN "Users" au ON r."AssignedUserId" = au."Id"
LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
LEFT JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
LEFT JOIN "Workflow" w ON r."WorkflowID" = w."WorkflowID"
LEFT JOIN "Departments" d ON au."DepartmentID" = d."DepartmentID";

-- Insert sample data for Departments
INSERT INTO "Departments" ("Name", "Description", "CreatedAt", "IsActive") VALUES 
('IT', 'Information Technology Department', NOW(), true),
('Nhân sự', 'Human Resources Department', NOW(), true),
('Kế toán', 'Accounting Department', NOW(), true),
('Marketing', 'Marketing Department', NOW(), true),
('Bán hàng', 'Sales Department', NOW(), true),
('Hành chính', 'Administration Department', NOW(), true),
('Kỹ thuật', 'Engineering Department', NOW(), true),
('Chăm sóc khách hàng', 'Customer Service Department', NOW(), true);

-- Insert sample data for Status
INSERT INTO "Status" ("StatusName", "Description", "IsFinal", "CreatedAt") VALUES 
('Mới', 'Request mới được tạo', false, NOW()),
('Đang xử lý', 'Đang được xử lý', false, NOW()),
('Hoàn thành', 'Đã hoàn thành', true, NOW()),
('Từ chối', 'Bị từ chối', true, NOW()),
('Tạm hoãn', 'Tạm thời hoãn lại', false, NOW());

-- Insert sample data for Priority
INSERT INTO "Priority" ("PriorityName", "Description", "IsActive", "BusinessDays", "BusinessEndHour", "BusinessStartHour", "CriticalThreshold", "SlaTarget", "WarningThreshold") VALUES 
('Thấp', 'Mức độ ưu tiên thấp - Xử lý trong 5 ngày làm việc', TRUE, '1,2,3,4,5', 17, 8, 80.00, 95.00, 85.00),
('Trung bình', 'Mức độ ưu tiên trung bình - Xử lý trong 3 ngày làm việc', TRUE, '1,2,3,4,5', 17, 8, 60.00, 90.00, 70.00),
('Cao', 'Mức độ ưu tiên cao - Xử lý trong 1 ngày làm việc', TRUE, '1,2,3,4,5', 17, 8, 40.00, 85.00, 50.00),
('Khẩn cấp', 'Cần xử lý ngay lập tức - Trong 4 giờ', TRUE, '1,2,3,4,5,6,7', 23, 0, 20.00, 95.00, 30.00);

-- Comments for Supabase setup
COMMENT ON EXTENSION "uuid-ossp" IS 'UUID generation extension for PostgreSQL';
COMMENT ON TABLE "Users" IS 'User accounts with RLS enabled';
COMMENT ON TABLE "Requests" IS 'Main requests table with RLS policies';
COMMENT ON VIEW "user_dashboard" IS 'Dashboard view for user statistics';
COMMENT ON VIEW "request_details" IS 'Detailed view of requests with related information';
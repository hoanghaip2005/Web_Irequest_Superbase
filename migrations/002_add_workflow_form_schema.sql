-- Migration: Add FormSchema support for dynamic form builder
-- This migration adds sample FormSchema data to workflows

-- Add sample FormSchema to existing workflows
-- FormSchema is stored as JSON text containing field definitions

-- Example: IT Support Workflow - Add custom fields for hardware/software issues
UPDATE "Workflow" 
SET "FormSchema" = '[
  {
    "name": "issue_category",
    "label": "Loại vấn đề",
    "type": "select",
    "required": true,
    "options": [
      {"value": "hardware", "label": "Phần cứng"},
      {"value": "software", "label": "Phần mềm"},
      {"value": "network", "label": "Mạng"},
      {"value": "access", "label": "Quyền truy cập"}
    ],
    "placeholder": "Chọn loại vấn đề"
  },
  {
    "name": "device_type",
    "label": "Loại thiết bị",
    "type": "text",
    "required": false,
    "placeholder": "VD: Laptop Dell Latitude, Màn hình Samsung...",
    "helpText": "Ghi rõ model nếu biết"
  },
  {
    "name": "urgency_level",
    "label": "Mức độ khẩn cấp",
    "type": "radio",
    "required": true,
    "options": [
      {"value": "low", "label": "Thấp - Có thể chờ"},
      {"value": "medium", "label": "Trung bình - Cần xử lý trong ngày"},
      {"value": "high", "label": "Cao - Cần xử lý ngay"}
    ]
  },
  {
    "name": "affected_users",
    "label": "Số người bị ảnh hưởng",
    "type": "number",
    "required": false,
    "placeholder": "1",
    "min": 1,
    "helpText": "Số lượng người dùng bị ảnh hưởng bởi vấn đề này"
  },
  {
    "name": "error_screenshot",
    "label": "Ảnh chụp màn hình lỗi",
    "type": "file",
    "required": false,
    "accept": "image/*",
    "helpText": "Upload ảnh chụp màn hình nếu có lỗi hiển thị"
  },
  {
    "name": "has_tried_restart",
    "label": "Đã thử khởi động lại chưa?",
    "type": "checkbox",
    "required": false
  }
]'::TEXT
WHERE "WorkflowName" LIKE '%IT%' OR "WorkflowName" LIKE '%Support%' OR "WorkflowID" = 1;

-- Example: HR Request Workflow - Add fields for leave requests, personnel changes
UPDATE "Workflow" 
SET "FormSchema" = '[
  {
    "name": "request_type",
    "label": "Loại yêu cầu",
    "type": "select",
    "required": true,
    "options": [
      {"value": "leave", "label": "Nghỉ phép"},
      {"value": "overtime", "label": "Tăng ca"},
      {"value": "training", "label": "Đào tạo"},
      {"value": "equipment", "label": "Thiết bị văn phòng"},
      {"value": "other", "label": "Khác"}
    ]
  },
  {
    "name": "start_date",
    "label": "Ngày bắt đầu",
    "type": "date",
    "required": true
  },
  {
    "name": "end_date",
    "label": "Ngày kết thúc",
    "type": "date",
    "required": false
  },
  {
    "name": "number_of_days",
    "label": "Số ngày",
    "type": "number",
    "required": false,
    "min": 0.5,
    "step": 0.5
  },
  {
    "name": "leave_type",
    "label": "Loại nghỉ phép",
    "type": "select",
    "required": false,
    "options": [
      {"value": "annual", "label": "Phép năm"},
      {"value": "sick", "label": "Ốm đau"},
      {"value": "personal", "label": "Việc riêng"},
      {"value": "unpaid", "label": "Không lương"}
    ],
    "showIf": {"field": "request_type", "value": "leave"}
  },
  {
    "name": "replacement_person",
    "label": "Người thay thế công việc",
    "type": "text",
    "required": false,
    "placeholder": "Tên đồng nghiệp"
  }
]'::TEXT
WHERE "WorkflowName" LIKE '%HR%' OR "WorkflowName" LIKE '%Nhân sự%';

-- Example: Procurement Workflow - Add fields for purchase requests
UPDATE "Workflow" 
SET "FormSchema" = '[
  {
    "name": "item_name",
    "label": "Tên mặt hàng",
    "type": "text",
    "required": true,
    "placeholder": "VD: Máy in HP LaserJet Pro"
  },
  {
    "name": "quantity",
    "label": "Số lượng",
    "type": "number",
    "required": true,
    "min": 1,
    "placeholder": "1"
  },
  {
    "name": "estimated_cost",
    "label": "Chi phí dự kiến (VNĐ)",
    "type": "number",
    "required": true,
    "placeholder": "5000000"
  },
  {
    "name": "budget_code",
    "label": "Mã ngân sách",
    "type": "text",
    "required": false,
    "placeholder": "VD: IT-2024-Q1"
  },
  {
    "name": "vendor_preference",
    "label": "Nhà cung cấp đề xuất",
    "type": "text",
    "required": false,
    "placeholder": "Tên nhà cung cấp (nếu có)"
  },
  {
    "name": "justification",
    "label": "Lý do mua sắm",
    "type": "textarea",
    "required": true,
    "placeholder": "Giải thích lý do cần mua sắm...",
    "rows": 4
  },
  {
    "name": "urgent_procurement",
    "label": "Mua sắm khẩn cấp",
    "type": "checkbox",
    "required": false,
    "helpText": "Đánh dấu nếu cần mua gấp"
  }
]'::TEXT
WHERE "WorkflowName" LIKE '%Procurement%' OR "WorkflowName" LIKE '%Mua sắm%';

-- Add default FormSchema for workflows without one
UPDATE "Workflow" 
SET "FormSchema" = '[
  {
    "name": "additional_info",
    "label": "Thông tin bổ sung",
    "type": "textarea",
    "required": false,
    "placeholder": "Thông tin bổ sung về yêu cầu...",
    "rows": 3
  },
  {
    "name": "attachment",
    "label": "Tài liệu đính kèm",
    "type": "file",
    "required": false,
    "helpText": "Upload tài liệu liên quan nếu có"
  }
]'::TEXT
WHERE "FormSchema" IS NULL OR "FormSchema" = '';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS "IX_Workflow_IsActive" ON "Workflow" ("IsActive");
CREATE INDEX IF NOT EXISTS "IX_Requests_WorkflowID" ON "Requests" ("WorkflowID");

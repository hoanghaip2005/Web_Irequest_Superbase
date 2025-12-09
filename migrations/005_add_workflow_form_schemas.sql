-- Add sample FormSchema to existing workflows
-- This demonstrates the form builder functionality

-- Update IT Support Workflow với form schema mẫu
UPDATE "Workflow"
SET "FormSchema" = '[
  {
    "name": "system_name",
    "type": "text",
    "label": "Tên hệ thống/Phần mềm",
    "placeholder": "Ví dụ: ERP, CRM, Website...",
    "required": true,
    "helpText": "Nhập tên hệ thống hoặc phần mềm gặp sự cố"
  },
  {
    "name": "error_message",
    "type": "textarea",
    "label": "Thông báo lỗi (nếu có)",
    "placeholder": "Copy thông báo lỗi chính xác từ hệ thống...",
    "required": false,
    "helpText": "Cung cấp thông báo lỗi giúp xác định vấn đề nhanh hơn"
  },
  {
    "name": "urgency_level",
    "type": "select",
    "label": "Mức độ ảnh hưởng",
    "required": true,
    "options": [
      {"value": "critical", "label": "Nghiêm trọng - Hệ thống ngưng hoàn toàn"},
      {"value": "high", "label": "Cao - Ảnh hưởng nhiều người dùng"},
      {"value": "medium", "label": "Trung bình - Ảnh hưởng một số chức năng"},
      {"value": "low", "label": "Thấp - Vấn đề nhỏ, có cách giải quyết tạm thời"}
    ]
  },
  {
    "name": "affected_users",
    "type": "number",
    "label": "Số lượng người dùng bị ảnh hưởng",
    "placeholder": "Ví dụ: 10",
    "required": false,
    "min": 0,
    "helpText": "Ước tính số người dùng gặp vấn đề này"
  },
  {
    "name": "steps_to_reproduce",
    "type": "textarea",
    "label": "Các bước tái hiện lỗi",
    "placeholder": "1. Đăng nhập vào hệ thống\n2. Click vào menu X\n3. Chọn chức năng Y...",
    "required": false,
    "rows": 5,
    "helpText": "Liệt kê các bước để tái hiện lỗi"
  },
  {
    "name": "screenshot",
    "type": "file",
    "label": "Screenshot/Ảnh chụp màn hình",
    "accept": "image/*",
    "required": false,
    "helpText": "Đính kèm ảnh chụp màn hình lỗi nếu có"
  },
  {
    "name": "temporary_solution",
    "type": "textarea",
    "label": "Giải pháp tạm thời đã thử",
    "placeholder": "Ví dụ: Đã thử khởi động lại ứng dụng, xóa cache...",
    "required": false,
    "helpText": "Những cách đã thử để khắc phục tạm thời"
  }
]'::TEXT
WHERE "WorkflowID" = (
  SELECT "WorkflowID" FROM "Workflow" 
  WHERE "WorkflowName" LIKE '%IT%' OR "WorkflowName" LIKE '%Support%' OR "WorkflowName" LIKE '%Technical%'
  LIMIT 1
);

-- Update HR Workflow với form schema mẫu
UPDATE "Workflow"
SET "FormSchema" = '[
  {
    "name": "request_type",
    "type": "select",
    "label": "Loại yêu cầu",
    "required": true,
    "options": [
      {"value": "leave", "label": "Xin nghỉ phép"},
      {"value": "timeoff", "label": "Xin thời gian nghỉ"},
      {"value": "certificate", "label": "Xin giấy tờ/Chứng nhận"},
      {"value": "info_update", "label": "Cập nhật thông tin cá nhân"},
      {"value": "other", "label": "Khác"}
    ]
  },
  {
    "name": "start_date",
    "type": "date",
    "label": "Ngày bắt đầu",
    "required": true,
    "helpText": "Ngày bắt đầu nghỉ phép/yêu cầu có hiệu lực"
  },
  {
    "name": "end_date",
    "type": "date",
    "label": "Ngày kết thúc",
    "required": false,
    "helpText": "Ngày kết thúc (nếu áp dụng)"
  },
  {
    "name": "total_days",
    "type": "number",
    "label": "Tổng số ngày",
    "placeholder": "1",
    "required": false,
    "min": 0.5,
    "step": 0.5,
    "helpText": "Tổng số ngày nghỉ (có thể là 0.5 cho nửa ngày)"
  },
  {
    "name": "reason",
    "type": "textarea",
    "label": "Lý do",
    "placeholder": "Nhập lý do xin nghỉ phép hoặc yêu cầu...",
    "required": true,
    "rows": 4
  },
  {
    "name": "backup_person",
    "type": "text",
    "label": "Người thay thế công việc",
    "placeholder": "Tên đồng nghiệp sẽ đảm nhận công việc",
    "required": false,
    "helpText": "Người sẽ đảm nhận công việc trong thời gian nghỉ"
  },
  {
    "name": "has_handover",
    "type": "checkbox",
    "label": "Đã bàn giao công việc",
    "required": false
  }
]'::TEXT
WHERE "WorkflowID" = (
  SELECT "WorkflowID" FROM "Workflow" 
  WHERE "WorkflowName" LIKE '%HR%' OR "WorkflowName" LIKE '%Nhân sự%' OR "WorkflowName" LIKE '%Leave%'
  LIMIT 1
);

-- Update Procurement/Mua sắm Workflow
UPDATE "Workflow"
SET "FormSchema" = '[
  {
    "name": "item_category",
    "type": "select",
    "label": "Danh mục tài sản",
    "required": true,
    "options": [
      {"value": "office_supplies", "label": "Văn phòng phẩm"},
      {"value": "equipment", "label": "Thiết bị"},
      {"value": "software", "label": "Phần mềm/License"},
      {"value": "furniture", "label": "Nội thất"},
      {"value": "other", "label": "Khác"}
    ]
  },
  {
    "name": "item_name",
    "type": "text",
    "label": "Tên tài sản/Vật phẩm",
    "placeholder": "Ví dụ: Máy tính Dell Latitude 5420",
    "required": true
  },
  {
    "name": "quantity",
    "type": "number",
    "label": "Số lượng",
    "placeholder": "1",
    "required": true,
    "min": 1
  },
  {
    "name": "estimated_price",
    "type": "number",
    "label": "Giá ước tính (VND)",
    "placeholder": "10000000",
    "required": false,
    "min": 0,
    "step": 1000,
    "helpText": "Giá ước tính cho mỗi đơn vị"
  },
  {
    "name": "specifications",
    "type": "textarea",
    "label": "Thông số kỹ thuật/Yêu cầu",
    "placeholder": "CPU: Intel i5 gen 11\nRAM: 16GB\nSSD: 512GB...",
    "required": true,
    "rows": 5,
    "helpText": "Mô tả chi tiết thông số kỹ thuật hoặc yêu cầu"
  },
  {
    "name": "purpose",
    "type": "textarea",
    "label": "Mục đích sử dụng",
    "placeholder": "Sử dụng cho công việc phát triển phần mềm...",
    "required": true,
    "rows": 3
  },
  {
    "name": "preferred_supplier",
    "type": "text",
    "label": "Nhà cung cấp đề xuất",
    "placeholder": "Tên nhà cung cấp (nếu có)",
    "required": false
  },
  {
    "name": "urgency",
    "type": "select",
    "label": "Mức độ cần thiết",
    "required": true,
    "options": [
      {"value": "urgent", "label": "Khẩn cấp - Cần trong vòng 1 tuần"},
      {"value": "normal", "label": "Bình thường - Trong tháng"},
      {"value": "planned", "label": "Theo kế hoạch - Có thể chờ"}
    ]
  }
]'::TEXT
WHERE "WorkflowID" = (
  SELECT "WorkflowID" FROM "Workflow" 
  WHERE "WorkflowName" LIKE '%Procurement%' OR "WorkflowName" LIKE '%Mua sắm%' OR "WorkflowName" LIKE '%Purchase%'
  LIMIT 1
);

-- Comment
COMMENT ON COLUMN "Workflow"."FormSchema" IS 'JSON schema defining dynamic form fields for this workflow. Format: [{name, type, label, required, options, ...}]';

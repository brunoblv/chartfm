-- CreateTable
CREATE TABLE `curators_snapshots` (
    `id` VARCHAR(191) NOT NULL,
    `week_index` INTEGER NOT NULL,
    `week_label` VARCHAR(191) NOT NULL,
    `date_range` VARCHAR(191) NOT NULL,
    `entries` JSON NOT NULL,
    `frozen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `curators_snapshots_week_index_key`(`week_index`),
    INDEX `idx_curators_snapshots_week_index`(`week_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

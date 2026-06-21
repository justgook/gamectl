PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

DELETE FROM nine_patch
WHERE name IN (
    'button_disabled',
    'button_hover',
    'button_normal',
    'button_pressed',
    'nine_path_bg',
    'nine_path_bg_2',
    'nine_path_focus',
    'nine_path_panel',
    'nine_path_panel_2',
    'nine_path_panel_3',
    'nine_path_panel_disabled',
    'nine_path_panel_interior'
);

INSERT INTO nine_patch (
    name,
    display_name,
    description,
    image_path,
    slice_left,
    slice_top,
    slice_right,
    slice_bottom
)
VALUES
    ('button_disabled', 'Button Disabled', 'Demo nine-patch button state', 'catalog/nine/button_disabled.qoi', 4, 3, 12, 5),
    ('button_hover', 'Button Hover', 'Demo nine-patch button state', 'catalog/nine/button_hover.qoi', 4, 3, 12, 5),
    ('button_normal', 'Button Normal', 'Demo nine-patch button state', 'catalog/nine/button_normal.qoi', 4, 3, 12, 5),
    ('button_pressed', 'Button Pressed', 'Demo nine-patch button state', 'catalog/nine/button_pressed.qoi', 4, 3, 12, 5),
    ('nine_path_bg', 'Nine Patch Background', 'Demo nine-patch background panel', 'catalog/nine/nine_path_bg.qoi', 6, 7, 11, 10),
    ('nine_path_bg_2', 'Nine Patch Background 2', 'Demo nine-patch background panel variant', 'catalog/nine/nine_path_bg_2.qoi', 6, 7, 11, 10),
    ('nine_path_focus', 'Nine Patch Focus', 'Demo nine-patch focus outline', 'catalog/nine/nine_path_focus.qoi', 3, 3, 5, 5),
    ('nine_path_panel', 'Nine Patch Panel', 'Demo nine-patch panel', 'catalog/nine/nine_path_panel.qoi', 6, 7, 11, 10),
    ('nine_path_panel_2', 'Nine Patch Panel 2', 'Demo nine-patch panel variant', 'catalog/nine/nine_path_panel_2.qoi', 6, 7, 11, 10),
    ('nine_path_panel_3', 'Nine Patch Panel 3', 'Demo nine-patch panel variant', 'catalog/nine/nine_path_panel_3.qoi', 6, 7, 11, 10),
    ('nine_path_panel_disabled', 'Nine Patch Panel Disabled', 'Demo nine-patch disabled panel', 'catalog/nine/nine_path_panel_disabled.qoi', 6, 7, 11, 10),
    ('nine_path_panel_interior', 'Nine Patch Panel Interior', 'Demo nine-patch panel interior', 'catalog/nine/nine_path_panel_interior.qoi', 6, 7, 11, 10);

COMMIT;

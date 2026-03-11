package logic


// Component storage using dynamic arrays and sparse sets
Component_Storage :: struct($T: typeid) {
	// Dense array of components
	components: [dynamic]T,
	// Dense array of entity IDs corresponding to components
	entity_ids: [dynamic]int,
	// Sparse array mapping entity IDs to dense array indices
	sparse:     map[int]int,
}

Component_Storage_Fixed :: struct($T: typeid, $N: int) {
	components: [N]T,
	entity_ids: [N]int,
	sparse:     map[int]int,
	count:      int,
}

Storage_View :: struct($T: typeid) {
	components: []T,
	entity_ids: []int,
	sparse:     map[int]int,
}

// make_storage :: proc($T: typeid) -> Component_Storage(T) {
// 	return Component_Storage(T) {
// 		components = make([dynamic]T),
// 		entity_ids = make([dynamic]int),
// 		sparse = make(map[int]int),
// 	}
// }

destroy_storage_dynamic :: proc(storage: ^Component_Storage($T)) {
	delete(storage.components)
	delete(storage.entity_ids)
	delete(storage.sparse)
}

destroy_storage_fixed :: proc(storage: ^Component_Storage_Fixed($T, $N)) {
	delete(storage.sparse)
	storage.count = 0
}

destroy_storage :: proc {
	destroy_storage_dynamic,
	destroy_storage_fixed,
}

add_component_dynamic :: proc(storage: ^Component_Storage($T), entity_id: int, component: T) {
	if storage.sparse == nil {
		storage.sparse = make(map[int]int)
	}

	if entity_id in storage.sparse {
		idx := storage.sparse[entity_id]
		storage.components[idx] = component
		return
	}

	append(&storage.components, component)
	append(&storage.entity_ids, entity_id)
	storage.sparse[entity_id] = len(storage.components) - 1
}

add_component_fixed :: proc(storage: ^Component_Storage_Fixed($T, $N), entity_id: int, component: T) {
	if storage.sparse == nil {
		storage.sparse = make(map[int]int)
	}

	if entity_id in storage.sparse {
		idx := storage.sparse[entity_id]
		storage.components[idx] = component
		return
	}

	assert(storage.count < N)

	storage.components[storage.count] = component
	storage.entity_ids[storage.count] = entity_id
	storage.sparse[entity_id] = storage.count
	storage.count += 1
	return
}

add_component :: proc {
	add_component_dynamic,
	add_component_fixed,
}


delete_component_dynamic :: proc(storage: ^Component_Storage($T), entity_id: int) -> (ok: bool) {
	// Get the index from the sparse array
	dense_idx, exists := storage.sparse[entity_id]
	if !exists {
		return false
	}

	unordered_remove(&storage.components, dense_idx)
	unordered_remove(&storage.entity_ids, dense_idx)

	// Update the sparse map for the moved entity if there was one
	if len(storage.entity_ids) > dense_idx {
		moved_entity_id := storage.entity_ids[dense_idx]
		storage.sparse[moved_entity_id] = dense_idx
	}

	delete_key(&storage.sparse, entity_id)

	return true
}

delete_component_fixed :: proc(storage: ^Component_Storage_Fixed($T, $N), entity_id: int) -> (ok: bool) {
	dense_idx, exists := storage.sparse[entity_id]
	if !exists {
		return false
	}

	last_idx := storage.count - 1
	if dense_idx != last_idx {
		storage.components[dense_idx] = storage.components[last_idx]
		storage.entity_ids[dense_idx] = storage.entity_ids[last_idx]

		moved_entity_id := storage.entity_ids[dense_idx]
		storage.sparse[moved_entity_id] = dense_idx
	}

	storage.count -= 1
	delete_key(&storage.sparse, entity_id)

	return true
}

delete_component :: proc {
	delete_component_dynamic,
	delete_component_fixed,
}

@(require_results)
get_component_dynamic :: proc(storage: ^Component_Storage($T), entity_id: int) -> (^T, bool) #optional_ok {
	if idx, ok := storage.sparse[entity_id]; ok {
		return &storage.components[idx], true
	}

	return nil, false
}

@(require_results)
get_component_fixed :: proc(storage: ^Component_Storage_Fixed($T, $N), entity_id: int) -> (^T, bool) #optional_ok {
	if idx, ok := storage.sparse[entity_id]; ok {
		return &storage.components[idx], true
	}

	return nil, false
}

@(require_results)
get_component :: proc {
	get_component_dynamic,
	get_component_fixed,
}

@(require_results)
has_component_dynamic :: proc(storage: ^Component_Storage($T), entity_id: int) -> bool {
	return entity_id in storage.sparse
}

@(require_results)
has_component_fixed :: proc(storage: ^Component_Storage_Fixed($T, $N), entity_id: int) -> bool {
	return entity_id in storage.sparse
}

@(require_results)
has_component_view :: proc(storage: Storage_View($T), entity_id: int) -> bool {
	return entity_id in storage.sparse
}

@(require_results)
has_component :: proc {
	has_component_dynamic,
	has_component_fixed,
	has_component_view,
}

with_component_dynamic :: proc(storage: ^Component_Storage($T), entity_id: int, fn: proc(c: ^T)) {
	idx, ok := storage.sparse[entity_id]
	if !ok {
		return
	}

	fn(&storage.components[idx])
}

with_component_fixed :: proc(storage: ^Component_Storage_Fixed($T, $N), entity_id: int, fn: proc(c: ^T)) {
	idx, ok := storage.sparse[entity_id]
	if !ok {
		return
	}

	fn(&storage.components[idx])
}

with_component :: proc {
	with_component_dynamic,
	with_component_fixed,
}

@(require_results)
storage_view_dynamic :: proc(storage: ^Component_Storage($T)) -> Storage_View(T) {
	return Storage_View(T){
		components = storage.components[:],
		entity_ids = storage.entity_ids[:],
		sparse = storage.sparse,
	}
}

@(require_results)
storage_view_fixed :: proc(storage: ^Component_Storage_Fixed($T, $N)) -> Storage_View(T) {
	return Storage_View(T){
		components = storage.components[:storage.count],
		entity_ids = storage.entity_ids[:storage.count],
		sparse = storage.sparse,
	}
}

@(require_results)
storage_view :: proc {
	storage_view_dynamic,
	storage_view_fixed,
}


View1 :: struct($A: typeid) {
	storage_a:     Storage_View(A),
	current_index: int,
}

View2 :: struct($A, $B: typeid) {
	storage_a:     Storage_View(A),
	storage_b:     Storage_View(B),
	current_index: int,
}

View3 :: struct($A, $B, $C: typeid) {
	storage_a:     Storage_View(A),
	storage_b:     Storage_View(B),
	storage_c:     Storage_View(C),
	current_index: int,
}


View4 :: struct($A, $B, $C, $D: typeid) {
	storage_a:     Storage_View(A),
	storage_b:     Storage_View(B),
	storage_c:     Storage_View(C),
	storage_d:     Storage_View(D),
	current_index: int,
}

@(require_results)
view :: proc {
	make_view1_dynamic,
	make_view1_fixed,
	make_view2_dd,
	make_view2_fd,
	make_view2_df,
	make_view2_ff,
	make_view3_ddd,
	make_view3_fdd,
	make_view3_dfd,
	make_view3_ddf,
	make_view3_ffd,
	make_view3_fdf,
	make_view3_dff,
	make_view3_fff,
	make_view4_dddd,
	make_view4_fddd,
	make_view4_dfdd,
	make_view4_ddff,
	make_view4_ddfd,
	make_view4_dddf,
	make_view4_ffff,
	make_view4_fffd,
	make_view4_ffdf,
	make_view4_fdff,
	make_view4_dfff,
	make_view4_ffdd,
	make_view4_fdfd,
	make_view4_fddf,
	make_view4_dffd,
	make_view4_dfdf,
}

@(require_results)
make_view1_dynamic :: proc(storage_a: ^Component_Storage($A)) -> View1(A) {
	return View1(A){storage_a = storage_view(storage_a), current_index = 0}
}

@(require_results)
make_view1_fixed :: proc(storage_a: ^Component_Storage_Fixed($A, $N)) -> View1(A) {
	return View1(A){storage_a = storage_view(storage_a), current_index = 0}
}

@(require_results)
make_view1 :: proc {
	make_view1_dynamic,
	make_view1_fixed,
}

@(require_results)
make_view2_dd :: proc(
	storage_a: ^Component_Storage($A),
	storage_b: ^Component_Storage($B),
) -> View2(A, B) {
	return View2(A, B){storage_a = storage_view(storage_a), storage_b = storage_view(storage_b), current_index = 0}
}

@(require_results)
make_view2_fd :: proc(
	storage_a: ^Component_Storage_Fixed($A, $NA),
	storage_b: ^Component_Storage($B),
) -> View2(A, B) {
	return View2(A, B){storage_a = storage_view(storage_a), storage_b = storage_view(storage_b), current_index = 0}
}

@(require_results)
make_view2_df :: proc(
	storage_a: ^Component_Storage($A),
	storage_b: ^Component_Storage_Fixed($B, $NB),
) -> View2(A, B) {
	return View2(A, B){storage_a = storage_view(storage_a), storage_b = storage_view(storage_b), current_index = 0}
}

@(require_results)
make_view2_ff :: proc(
	storage_a: ^Component_Storage_Fixed($A, $NA),
	storage_b: ^Component_Storage_Fixed($B, $NB),
) -> View2(A, B) {
	return View2(A, B){storage_a = storage_view(storage_a), storage_b = storage_view(storage_b), current_index = 0}
}

@(require_results)
make_view2 :: proc {
	make_view2_dd,
	make_view2_fd,
	make_view2_df,
	make_view2_ff,
}

@(require_results)
make_view3_ddd :: proc(
	storage_a: ^Component_Storage($A),
	storage_b: ^Component_Storage($B),
	storage_c: ^Component_Storage($C),
) -> View3(A, B, C) {
	return View3(A, B, C) {
		storage_a = storage_view(storage_a),
		storage_b = storage_view(storage_b),
		storage_c = storage_view(storage_c),
		current_index = 0,
	}
}

@(require_results)
make_view3_fdd :: proc(
	storage_a: ^Component_Storage_Fixed($A, $NA),
	storage_b: ^Component_Storage($B),
	storage_c: ^Component_Storage($C),
) -> View3(A, B, C) {
	return View3(A, B, C) {
		storage_a = storage_view(storage_a),
		storage_b = storage_view(storage_b),
		storage_c = storage_view(storage_c),
		current_index = 0,
	}
}

@(require_results)
make_view3_dfd :: proc(
	storage_a: ^Component_Storage($A),
	storage_b: ^Component_Storage_Fixed($B, $NB),
	storage_c: ^Component_Storage($C),
) -> View3(A, B, C) {
	return View3(A, B, C) {
		storage_a = storage_view(storage_a),
		storage_b = storage_view(storage_b),
		storage_c = storage_view(storage_c),
		current_index = 0,
	}
}

@(require_results)
make_view3_ddf :: proc(
	storage_a: ^Component_Storage($A),
	storage_b: ^Component_Storage($B),
	storage_c: ^Component_Storage_Fixed($C, $NC),
) -> View3(A, B, C) {
	return View3(A, B, C) {
		storage_a = storage_view(storage_a),
		storage_b = storage_view(storage_b),
		storage_c = storage_view(storage_c),
		current_index = 0,
	}
}

@(require_results)
make_view3_ffd :: proc(
	storage_a: ^Component_Storage_Fixed($A, $NA),
	storage_b: ^Component_Storage_Fixed($B, $NB),
	storage_c: ^Component_Storage($C),
) -> View3(A, B, C) {
	return View3(A, B, C) {
		storage_a = storage_view(storage_a),
		storage_b = storage_view(storage_b),
		storage_c = storage_view(storage_c),
		current_index = 0,
	}
}

@(require_results)
make_view3_fdf :: proc(
	storage_a: ^Component_Storage_Fixed($A, $NA),
	storage_b: ^Component_Storage($B),
	storage_c: ^Component_Storage_Fixed($C, $NC),
) -> View3(A, B, C) {
	return View3(A, B, C) {
		storage_a = storage_view(storage_a),
		storage_b = storage_view(storage_b),
		storage_c = storage_view(storage_c),
		current_index = 0,
	}
}

@(require_results)
make_view3_dff :: proc(
	storage_a: ^Component_Storage($A),
	storage_b: ^Component_Storage_Fixed($B, $NB),
	storage_c: ^Component_Storage_Fixed($C, $NC),
) -> View3(A, B, C) {
	return View3(A, B, C) {
		storage_a = storage_view(storage_a),
		storage_b = storage_view(storage_b),
		storage_c = storage_view(storage_c),
		current_index = 0,
	}
}

@(require_results)
make_view3_fff :: proc(
	storage_a: ^Component_Storage_Fixed($A, $NA),
	storage_b: ^Component_Storage_Fixed($B, $NB),
	storage_c: ^Component_Storage_Fixed($C, $NC),
) -> View3(A, B, C) {
	return View3(A, B, C) {
		storage_a = storage_view(storage_a),
		storage_b = storage_view(storage_b),
		storage_c = storage_view(storage_c),
		current_index = 0,
	}
}

@(require_results)
make_view3 :: proc {
	make_view3_ddd,
	make_view3_fdd,
	make_view3_dfd,
	make_view3_ddf,
	make_view3_ffd,
	make_view3_fdf,
	make_view3_dff,
	make_view3_fff,
}


@(require_results)
make_view4_dddd :: proc(
	storage_a: ^Component_Storage($A),
	storage_b: ^Component_Storage($B),
	storage_c: ^Component_Storage($C),
	storage_d: ^Component_Storage($D),
) -> View4(A, B, C, D) {
	return View4(A, B, C, D) {
		storage_a = storage_view(storage_a),
		storage_b = storage_view(storage_b),
		storage_c = storage_view(storage_c),
		storage_d = storage_view(storage_d),
		current_index = 0,
	}
}

@(require_results)
make_view4_fddd :: proc(
	storage_a: ^Component_Storage_Fixed($A, $NA),
	storage_b: ^Component_Storage($B),
	storage_c: ^Component_Storage($C),
	storage_d: ^Component_Storage($D),
) -> View4(A, B, C, D) {
	return View4(A, B, C, D) {
		storage_a = storage_view(storage_a),
		storage_b = storage_view(storage_b),
		storage_c = storage_view(storage_c),
		storage_d = storage_view(storage_d),
		current_index = 0,
	}
}

@(require_results)
make_view4_dfdd :: proc(
	storage_a: ^Component_Storage($A),
	storage_b: ^Component_Storage_Fixed($B, $NB),
	storage_c: ^Component_Storage($C),
	storage_d: ^Component_Storage($D),
) -> View4(A, B, C, D) {
	return View4(A, B, C, D) {
		storage_a = storage_view(storage_a),
		storage_b = storage_view(storage_b),
		storage_c = storage_view(storage_c),
		storage_d = storage_view(storage_d),
		current_index = 0,
	}
}

@(require_results)
make_view4_ddff :: proc(
	storage_a: ^Component_Storage($A),
	storage_b: ^Component_Storage($B),
	storage_c: ^Component_Storage_Fixed($C, $NC),
	storage_d: ^Component_Storage_Fixed($D, $ND),
) -> View4(A, B, C, D) {
	return View4(A, B, C, D) {
		storage_a = storage_view(storage_a),
		storage_b = storage_view(storage_b),
		storage_c = storage_view(storage_c),
		storage_d = storage_view(storage_d),
		current_index = 0,
	}
}

@(require_results)
make_view4_ddfd :: proc(
	storage_a: ^Component_Storage($A),
	storage_b: ^Component_Storage($B),
	storage_c: ^Component_Storage_Fixed($C, $NC),
	storage_d: ^Component_Storage($D),
) -> View4(A, B, C, D) {
	return View4(A, B, C, D) {
		storage_a = storage_view(storage_a),
		storage_b = storage_view(storage_b),
		storage_c = storage_view(storage_c),
		storage_d = storage_view(storage_d),
		current_index = 0,
	}
}

@(require_results)
make_view4_dddf :: proc(
	storage_a: ^Component_Storage($A),
	storage_b: ^Component_Storage($B),
	storage_c: ^Component_Storage($C),
	storage_d: ^Component_Storage_Fixed($D, $ND),
) -> View4(A, B, C, D) {
	return View4(A, B, C, D) {
		storage_a = storage_view(storage_a),
		storage_b = storage_view(storage_b),
		storage_c = storage_view(storage_c),
		storage_d = storage_view(storage_d),
		current_index = 0,
	}
}

@(require_results)
make_view4_ffff :: proc(
	storage_a: ^Component_Storage_Fixed($A, $NA),
	storage_b: ^Component_Storage_Fixed($B, $NB),
	storage_c: ^Component_Storage_Fixed($C, $NC),
	storage_d: ^Component_Storage_Fixed($D, $ND),
) -> View4(A, B, C, D) {
	return View4(A, B, C, D) {
		storage_a = storage_view(storage_a),
		storage_b = storage_view(storage_b),
		storage_c = storage_view(storage_c),
		storage_d = storage_view(storage_d),
		current_index = 0,
	}
}

@(require_results)
make_view4_fffd :: proc(
	storage_a: ^Component_Storage_Fixed($A, $NA),
	storage_b: ^Component_Storage_Fixed($B, $NB),
	storage_c: ^Component_Storage_Fixed($C, $NC),
	storage_d: ^Component_Storage($D),
) -> View4(A, B, C, D) {
	return View4(A, B, C, D) {
		storage_a = storage_view(storage_a),
		storage_b = storage_view(storage_b),
		storage_c = storage_view(storage_c),
		storage_d = storage_view(storage_d),
		current_index = 0,
	}
}

@(require_results)
make_view4_ffdf :: proc(
	storage_a: ^Component_Storage_Fixed($A, $NA),
	storage_b: ^Component_Storage_Fixed($B, $NB),
	storage_c: ^Component_Storage($C),
	storage_d: ^Component_Storage_Fixed($D, $ND),
) -> View4(A, B, C, D) {
	return View4(A, B, C, D) {
		storage_a = storage_view(storage_a),
		storage_b = storage_view(storage_b),
		storage_c = storage_view(storage_c),
		storage_d = storage_view(storage_d),
		current_index = 0,
	}
}

@(require_results)
make_view4_fdff :: proc(
	storage_a: ^Component_Storage_Fixed($A, $NA),
	storage_b: ^Component_Storage($B),
	storage_c: ^Component_Storage_Fixed($C, $NC),
	storage_d: ^Component_Storage_Fixed($D, $ND),
) -> View4(A, B, C, D) {
	return View4(A, B, C, D) {
		storage_a = storage_view(storage_a),
		storage_b = storage_view(storage_b),
		storage_c = storage_view(storage_c),
		storage_d = storage_view(storage_d),
		current_index = 0,
	}
}

@(require_results)
make_view4_dfff :: proc(
	storage_a: ^Component_Storage($A),
	storage_b: ^Component_Storage_Fixed($B, $NB),
	storage_c: ^Component_Storage_Fixed($C, $NC),
	storage_d: ^Component_Storage_Fixed($D, $ND),
) -> View4(A, B, C, D) {
	return View4(A, B, C, D) {
		storage_a = storage_view(storage_a),
		storage_b = storage_view(storage_b),
		storage_c = storage_view(storage_c),
		storage_d = storage_view(storage_d),
		current_index = 0,
	}
}

@(require_results)
make_view4_ffdd :: proc(
	storage_a: ^Component_Storage_Fixed($A, $NA),
	storage_b: ^Component_Storage_Fixed($B, $NB),
	storage_c: ^Component_Storage($C),
	storage_d: ^Component_Storage($D),
) -> View4(A, B, C, D) {
	return View4(A, B, C, D) {
		storage_a = storage_view(storage_a),
		storage_b = storage_view(storage_b),
		storage_c = storage_view(storage_c),
		storage_d = storage_view(storage_d),
		current_index = 0,
	}
}

@(require_results)
make_view4_fdfd :: proc(
	storage_a: ^Component_Storage_Fixed($A, $NA),
	storage_b: ^Component_Storage($B),
	storage_c: ^Component_Storage_Fixed($C, $NC),
	storage_d: ^Component_Storage($D),
) -> View4(A, B, C, D) {
	return View4(A, B, C, D) {
		storage_a = storage_view(storage_a),
		storage_b = storage_view(storage_b),
		storage_c = storage_view(storage_c),
		storage_d = storage_view(storage_d),
		current_index = 0,
	}
}

@(require_results)
make_view4_fddf :: proc(
	storage_a: ^Component_Storage_Fixed($A, $NA),
	storage_b: ^Component_Storage($B),
	storage_c: ^Component_Storage($C),
	storage_d: ^Component_Storage_Fixed($D, $ND),
) -> View4(A, B, C, D) {
	return View4(A, B, C, D) {
		storage_a = storage_view(storage_a),
		storage_b = storage_view(storage_b),
		storage_c = storage_view(storage_c),
		storage_d = storage_view(storage_d),
		current_index = 0,
	}
}

@(require_results)
make_view4_dffd :: proc(
	storage_a: ^Component_Storage($A),
	storage_b: ^Component_Storage_Fixed($B, $NB),
	storage_c: ^Component_Storage_Fixed($C, $NC),
	storage_d: ^Component_Storage($D),
) -> View4(A, B, C, D) {
	return View4(A, B, C, D) {
		storage_a = storage_view(storage_a),
		storage_b = storage_view(storage_b),
		storage_c = storage_view(storage_c),
		storage_d = storage_view(storage_d),
		current_index = 0,
	}
}

@(require_results)
make_view4_dfdf :: proc(
	storage_a: ^Component_Storage($A),
	storage_b: ^Component_Storage_Fixed($B, $NB),
	storage_c: ^Component_Storage($C),
	storage_d: ^Component_Storage_Fixed($D, $ND),
) -> View4(A, B, C, D) {
	return View4(A, B, C, D) {
		storage_a = storage_view(storage_a),
		storage_b = storage_view(storage_b),
		storage_c = storage_view(storage_c),
		storage_d = storage_view(storage_d),
		current_index = 0,
	}
}

@(require_results)
make_view4 :: proc {
	make_view4_dddd,
	make_view4_fddd,
	make_view4_dfdd,
	make_view4_ddff,
	make_view4_ddfd,
	make_view4_dddf,
	make_view4_ffff,
	make_view4_fffd,
	make_view4_ffdf,
	make_view4_fdff,
	make_view4_dfff,
	make_view4_ffdd,
	make_view4_fdfd,
	make_view4_fddf,
	make_view4_dffd,
	make_view4_dfdf,
}

each_comonent_dynamic :: proc(s: ^Component_Storage($A), fn: proc(id: int, c: ^A)) {
	for id, i in s.sparse {
		fn(id, &s.components[i])
	}
}

each_comonent_fixed :: proc(s: ^Component_Storage_Fixed($A, $N), fn: proc(id: int, c: ^A)) {
	for id, i in s.sparse {
		fn(id, &s.components[i])
	}
}

each_comonent :: proc {
	each_comonent_dynamic,
	each_comonent_fixed,
}

each :: proc {
	each_comonent_dynamic,
	each_comonent_fixed,
	each_view1,
	each_view2,
	each_view3,
	each_view4,
}

each_view1 :: proc(view: ^View1($A)) -> (id: int, a: ^A, ok: bool) {
	if ok = view.current_index < len(view.storage_a.entity_ids); ok {
		id = view.storage_a.entity_ids[view.current_index]
		a = &view.storage_a.components[view.current_index]
		view.current_index += 1
	}

	return
}


each_view2 :: proc(view: ^View2($A, $B)) -> (id: int, a: ^A, b: ^B, ok: bool) {
	for view.current_index < len(view.storage_a.entity_ids) {
		id = view.storage_a.entity_ids[view.current_index]
		if ok = has_component(view.storage_b, id); ok {
			a = &view.storage_a.components[view.current_index]
			b_idx := view.storage_b.sparse[id]
			b = &view.storage_b.components[b_idx]
			view.current_index += 1
			return
		}
		view.current_index += 1
	}
	return
}


each_view3 :: proc(view: ^View3($A, $B, $C)) -> (id: int, a: ^A, b: ^B, c: ^C, ok: bool) {
	for view.current_index < len(view.storage_a.entity_ids) {
		id = view.storage_a.entity_ids[view.current_index]
		ok1 := has_component(view.storage_b, id)
		ok2 := has_component(view.storage_c, id)
		if ok = ok1 && ok2; ok {
			a = &view.storage_a.components[view.current_index]
			b_idx := view.storage_b.sparse[id]
			b = &view.storage_b.components[b_idx]
			c_idx := view.storage_c.sparse[id]
			c = &view.storage_c.components[c_idx]
			view.current_index += 1
			return
		}
		view.current_index += 1
	}
	return
}


each_view4 :: proc(
	view: ^View4($A, $B, $C, $D),
) -> (
	id: int,
	a: ^A,
	b: ^B,
	c: ^C,
	d: ^D,
	ok: bool,
) {
	for view.current_index < len(view.storage_a.entity_ids) {
		id = view.storage_a.entity_ids[view.current_index]
		ok1 := has_component(view.storage_b, id)
		ok2 := has_component(view.storage_c, id)
		ok3 := has_component(view.storage_d, id)
		if ok = ok1 && ok2 && ok3; ok {
			a = &view.storage_a.components[view.current_index]
			b_idx := view.storage_b.sparse[id]
			b = &view.storage_b.components[b_idx]
			c_idx := view.storage_c.sparse[id]
			c = &view.storage_c.components[c_idx]
			d_idx := view.storage_d.sparse[id]
			d = &view.storage_d.components[d_idx]

			view.current_index += 1
			return
		}
		view.current_index += 1
	}

	return
}

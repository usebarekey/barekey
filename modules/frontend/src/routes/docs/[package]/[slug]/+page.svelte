<script lang="ts">
    import * as Sidebar from "$lib/components/ui/sidebar/index.js";
    import LayoutSidebar from "@tabler/icons-svelte/icons/layout-sidebar";
    import ListLetters from "@tabler/icons-svelte/icons/list-letters";
</script>

<Sidebar.Provider style="--sidebar-width-icon: 2.5rem;">
    <Sidebar.Root variant="inset" collapsible="icon">
        <Sidebar.Header class="pl-2 pr-0 flex flex-row items-center justify-between transition-[padding] duration-[var(--resize-dur)] ease-[var(--resize-ease)] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0">
            <span class="font-logo t-sidebar-flyout t-sidebar-flyout-inline">Barekey</span>
            <Sidebar.Trigger class="group/sidebar-toggle flex items-center justify-center rounded-full card bg-foreground/5 size-10">
                <LayoutSidebar class="text-muted-foreground size-4 transition-colors duration-[var(--duration-fast)] ease-[var(--ease-in-out)] group-hover/sidebar-toggle:text-foreground motion-reduce:transition-none" />
            </Sidebar.Trigger>
        </Sidebar.Header>
        <Sidebar.Content class="t-sidebar-flyout">
            
        </Sidebar.Content>
    </Sidebar.Root>
    <Sidebar.Inset class="py-2 pr-2 transition-[padding] duration-[var(--resize-dur)] ease-[var(--resize-ease)]">
        <div class="flex flex-row items-center justify-between gap-2 h-full">
            <div class="h-full grow bg-linear-to-b from-foreground/5 to-foreground/2.5 card rounded-3xl p-8">

            </div>
            <div class="h-full w-fit flex-none bg-linear-to-b from-foreground/5 to-foreground/2.5 card rounded-3xl p-8">
                <div class="flex flex-row gap-2 items-center">
                    <ListLetters class="text-muted-foreground size-4" />
                    <span class="text-xs uppercase text-muted-foreground whitespace-nowrap">On this page</span>
                </div>
            </div>
        </div>
    </Sidebar.Inset>
</Sidebar.Provider>

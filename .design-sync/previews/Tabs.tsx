import { Tabs, TabsList, TabsTrigger, TabsLabel, TabsContent } from 'card-mania'

export const Pill = () => (
  <Tabs value="vault" onValueChange={() => {}}>
    <TabsList>
      <TabsTrigger value="vault">
        <TabsLabel value="vault" label="Vault" />
      </TabsTrigger>
      <TabsTrigger value="wishlist">
        <TabsLabel value="wishlist" label="Wishlist" />
      </TabsTrigger>
      <TabsTrigger value="selling">
        <TabsLabel value="selling" label="Selling" />
      </TabsTrigger>
    </TabsList>
    <TabsContent value="vault">
      <div style={{ padding: 16, color: '#fafafa' }}>Vault content</div>
    </TabsContent>
  </Tabs>
)
